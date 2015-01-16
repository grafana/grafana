package core

import (
	"database/sql"
	"errors"
	"reflect"
	"regexp"
	"sync"
)

func MapToSlice(query string, mp interface{}) (string, []interface{}, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return "", []interface{}{}, ErrNoMapPointer
	}

	args := make([]interface{}, 0)
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		args = append(args, vv.Elem().MapIndex(reflect.ValueOf(src[1:])).Interface())
		return "?"
	})
	return query, args, nil
}

func StructToSlice(query string, st interface{}) (string, []interface{}, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return "", []interface{}{}, ErrNoStructPointer
	}

	args := make([]interface{}, 0)
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		args = append(args, vv.Elem().FieldByName(src[1:]).Interface())
		return "?"
	})
	return query, args, nil
}

type DB struct {
	*sql.DB
	Mapper IMapper
}

func Open(driverName, dataSourceName string) (*DB, error) {
	db, err := sql.Open(driverName, dataSourceName)
	return &DB{db, NewCacheMapper(&SnakeMapper{})}, err
}

func (db *DB) Query(query string, args ...interface{}) (*Rows, error) {
	rows, err := db.DB.Query(query, args...)
	return &Rows{rows, db.Mapper}, err
}

func (db *DB) QueryMap(query string, mp interface{}) (*Rows, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return db.Query(query, args...)
}

func (db *DB) QueryStruct(query string, st interface{}) (*Rows, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return db.Query(query, args...)
}

type Row struct {
	*sql.Row
	// One of these two will be non-nil:
	err    error // deferred error for easy chaining
	Mapper IMapper
}

func (row *Row) Scan(dest ...interface{}) error {
	if row.err != nil {
		return row.err
	}
	return row.Row.Scan(dest...)
}

func (db *DB) QueryRow(query string, args ...interface{}) *Row {
	row := db.DB.QueryRow(query, args...)
	return &Row{row, nil, db.Mapper}
}

func (db *DB) QueryRowMap(query string, mp interface{}) *Row {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return &Row{nil, err, db.Mapper}
	}
	return db.QueryRow(query, args...)
}

func (db *DB) QueryRowStruct(query string, st interface{}) *Row {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return &Row{nil, err, db.Mapper}
	}
	return db.QueryRow(query, args...)
}

type Stmt struct {
	*sql.Stmt
	Mapper IMapper
	names  map[string]int
}

func (db *DB) Prepare(query string) (*Stmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := db.DB.Prepare(query)
	if err != nil {
		return nil, err
	}
	return &Stmt{stmt, db.Mapper, names}, nil
}

func (s *Stmt) ExecMap(mp interface{}) (sql.Result, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}
	return s.Stmt.Exec(args...)
}

func (s *Stmt) ExecStruct(st interface{}) (sql.Result, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}
	return s.Stmt.Exec(args...)
}

func (s *Stmt) Query(args ...interface{}) (*Rows, error) {
	rows, err := s.Stmt.Query(args...)
	if err != nil {
		return nil, err
	}
	return &Rows{rows, s.Mapper}, nil
}

func (s *Stmt) QueryMap(mp interface{}) (*Rows, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}

	return s.Query(args...)
}

func (s *Stmt) QueryStruct(st interface{}) (*Rows, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}

	return s.Query(args...)
}

func (s *Stmt) QueryRow(args ...interface{}) *Row {
	row := s.Stmt.QueryRow(args...)
	return &Row{row, nil, s.Mapper}
}

func (s *Stmt) QueryRowMap(mp interface{}) *Row {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return &Row{nil, errors.New("mp should be a map's pointer"), s.Mapper}
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}

	return s.QueryRow(args...)
}

func (s *Stmt) QueryRowStruct(st interface{}) *Row {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return &Row{nil, errors.New("st should be a struct's pointer"), s.Mapper}
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}

	return s.QueryRow(args...)
}

var (
	re = regexp.MustCompile(`[?](\w+)`)
)

// insert into (name) values (?)
// insert into (name) values (?name)
func (db *DB) ExecMap(query string, mp interface{}) (sql.Result, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return db.DB.Exec(query, args...)
}

func (db *DB) ExecStruct(query string, st interface{}) (sql.Result, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return db.DB.Exec(query, args...)
}

type Rows struct {
	*sql.Rows
	Mapper IMapper
}

// scan data to a struct's pointer according field index
func (rs *Rows) ScanStructByIndex(dest ...interface{}) error {
	if len(dest) == 0 {
		return errors.New("at least one struct")
	}

	vvvs := make([]reflect.Value, len(dest))
	for i, s := range dest {
		vv := reflect.ValueOf(s)
		if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
			return errors.New("dest should be a struct's pointer")
		}

		vvvs[i] = vv.Elem()
	}

	cols, err := rs.Columns()
	if err != nil {
		return err
	}
	newDest := make([]interface{}, len(cols))

	var i = 0
	for _, vvv := range vvvs {
		for j := 0; j < vvv.NumField(); j++ {
			newDest[i] = vvv.Field(j).Addr().Interface()
			i = i + 1
		}
	}

	return rs.Rows.Scan(newDest...)
}

type EmptyScanner struct {
}

func (EmptyScanner) Scan(src interface{}) error {
	return nil
}

var (
	fieldCache      = make(map[reflect.Type]map[string]int)
	fieldCacheMutex sync.RWMutex
)

func fieldByName(v reflect.Value, name string) reflect.Value {
	t := v.Type()
	fieldCacheMutex.RLock()
	cache, ok := fieldCache[t]
	fieldCacheMutex.RUnlock()
	if !ok {
		cache = make(map[string]int)
		for i := 0; i < v.NumField(); i++ {
			cache[t.Field(i).Name] = i
		}
		fieldCacheMutex.Lock()
		fieldCache[t] = cache
		fieldCacheMutex.Unlock()
	}

	if i, ok := cache[name]; ok {
		return v.Field(i)
	}

	return reflect.Zero(t)
}

// scan data to a struct's pointer according field name
func (rs *Rows) ScanStructByName(dest interface{}) error {
	vv := reflect.ValueOf(dest)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return errors.New("dest should be a struct's pointer")
	}

	cols, err := rs.Columns()
	if err != nil {
		return err
	}

	newDest := make([]interface{}, len(cols))
	var v EmptyScanner
	for j, name := range cols {
		f := fieldByName(vv.Elem(), rs.Mapper.Table2Obj(name))
		if f.IsValid() {
			newDest[j] = f.Addr().Interface()
		} else {
			newDest[j] = &v
		}
	}

	return rs.Rows.Scan(newDest...)
}

type cacheStruct struct {
	value reflect.Value
	idx   int
}

var (
	reflectCache      = make(map[reflect.Type]*cacheStruct)
	reflectCacheMutex sync.RWMutex
)

func ReflectNew(typ reflect.Type) reflect.Value {
	reflectCacheMutex.RLock()
	cs, ok := reflectCache[typ]
	reflectCacheMutex.RUnlock()

	const newSize = 200

	if !ok || cs.idx+1 > newSize-1 {
		cs = &cacheStruct{reflect.MakeSlice(reflect.SliceOf(typ), newSize, newSize), 0}
		reflectCacheMutex.Lock()
		reflectCache[typ] = cs
		reflectCacheMutex.Unlock()
	} else {
		reflectCacheMutex.Lock()
		cs.idx = cs.idx + 1
		reflectCacheMutex.Unlock()
	}
	return cs.value.Index(cs.idx).Addr()
}

// scan data to a slice's pointer, slice's length should equal to columns' number
func (rs *Rows) ScanSlice(dest interface{}) error {
	vv := reflect.ValueOf(dest)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Slice {
		return errors.New("dest should be a slice's pointer")
	}

	vvv := vv.Elem()
	cols, err := rs.Columns()
	if err != nil {
		return err
	}

	newDest := make([]interface{}, len(cols))

	for j := 0; j < len(cols); j++ {
		if j >= vvv.Len() {
			newDest[j] = reflect.New(vvv.Type().Elem()).Interface()
		} else {
			newDest[j] = vvv.Index(j).Addr().Interface()
		}
	}

	err = rs.Rows.Scan(newDest...)
	if err != nil {
		return err
	}

	srcLen := vvv.Len()
	for i := srcLen; i < len(cols); i++ {
		vvv = reflect.Append(vvv, reflect.ValueOf(newDest[i]).Elem())
	}
	return nil
}

// scan data to a map's pointer
func (rs *Rows) ScanMap(dest interface{}) error {
	vv := reflect.ValueOf(dest)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return errors.New("dest should be a map's pointer")
	}

	cols, err := rs.Columns()
	if err != nil {
		return err
	}

	newDest := make([]interface{}, len(cols))
	vvv := vv.Elem()

	for i, _ := range cols {
		newDest[i] = ReflectNew(vvv.Type().Elem()).Interface()
		//v := reflect.New(vvv.Type().Elem())
		//newDest[i] = v.Interface()
	}

	err = rs.Rows.Scan(newDest...)
	if err != nil {
		return err
	}

	for i, name := range cols {
		vname := reflect.ValueOf(name)
		vvv.SetMapIndex(vname, reflect.ValueOf(newDest[i]).Elem())
	}

	return nil
}

/*func (rs *Rows) ScanMap(dest interface{}) error {
	vv := reflect.ValueOf(dest)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return errors.New("dest should be a map's pointer")
	}

	cols, err := rs.Columns()
	if err != nil {
		return err
	}

	newDest := make([]interface{}, len(cols))
	err = rs.ScanSlice(newDest)
	if err != nil {
		return err
	}

	vvv := vv.Elem()

	for i, name := range cols {
		vname := reflect.ValueOf(name)
		vvv.SetMapIndex(vname, reflect.ValueOf(newDest[i]).Elem())
	}

	return nil
}*/

type Tx struct {
	*sql.Tx
	Mapper IMapper
}

func (db *DB) Begin() (*Tx, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return nil, err
	}
	return &Tx{tx, db.Mapper}, nil
}

func (tx *Tx) Prepare(query string) (*Stmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := tx.Tx.Prepare(query)
	if err != nil {
		return nil, err
	}
	return &Stmt{stmt, tx.Mapper, names}, nil
}

func (tx *Tx) Stmt(stmt *Stmt) *Stmt {
	// TODO:
	return stmt
}

func (tx *Tx) ExecMap(query string, mp interface{}) (sql.Result, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.Tx.Exec(query, args...)
}

func (tx *Tx) ExecStruct(query string, st interface{}) (sql.Result, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.Tx.Exec(query, args...)
}

func (tx *Tx) Query(query string, args ...interface{}) (*Rows, error) {
	rows, err := tx.Tx.Query(query, args...)
	if err != nil {
		return nil, err
	}
	return &Rows{rows, tx.Mapper}, nil
}

func (tx *Tx) QueryMap(query string, mp interface{}) (*Rows, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.Query(query, args...)
}

func (tx *Tx) QueryStruct(query string, st interface{}) (*Rows, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.Query(query, args...)
}

func (tx *Tx) QueryRow(query string, args ...interface{}) *Row {
	row := tx.Tx.QueryRow(query, args...)
	return &Row{row, nil, tx.Mapper}
}

func (tx *Tx) QueryRowMap(query string, mp interface{}) *Row {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return &Row{nil, err, tx.Mapper}
	}
	return tx.QueryRow(query, args...)
}

func (tx *Tx) QueryRowStruct(query string, st interface{}) *Row {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return &Row{nil, err, tx.Mapper}
	}
	return tx.QueryRow(query, args...)
}
