package xorm

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/go-xorm/core"
)

type inParam struct {
	colName string
	args    []interface{}
}

type incrParam struct {
	colName string
	arg     interface{}
}

type decrParam struct {
	colName string
	arg     interface{}
}

type exprParam struct {
	colName string
	expr    string
}

// statement save all the sql info for executing SQL
type Statement struct {
	RefTable      *core.Table
	Engine        *Engine
	Start         int
	LimitN        int
	WhereStr      string
	IdParam       *core.PK
	Params        []interface{}
	OrderStr      string
	JoinStr       string
	GroupByStr    string
	HavingStr     string
	ColumnStr     string
	columnMap     map[string]bool
	useAllCols    bool
	OmitStr       string
	ConditionStr  string
	AltTableName  string
	RawSQL        string
	RawParams     []interface{}
	UseCascade    bool
	UseAutoJoin   bool
	StoreEngine   string
	Charset       string
	BeanArgs      []interface{}
	UseCache      bool
	UseAutoTime   bool
	IsDistinct    bool
	TableAlias    string
	allUseBool    bool
	checkVersion  bool
	unscoped      bool
	mustColumnMap map[string]bool
	inColumns     map[string]*inParam
	incrColumns   map[string]incrParam
	decrColumns   map[string]decrParam
	exprColumns   map[string]exprParam
}

// init
func (statement *Statement) Init() {
	statement.RefTable = nil
	statement.Start = 0
	statement.LimitN = 0
	statement.WhereStr = ""
	statement.Params = make([]interface{}, 0)
	statement.OrderStr = ""
	statement.UseCascade = true
	statement.JoinStr = ""
	statement.GroupByStr = ""
	statement.HavingStr = ""
	statement.ColumnStr = ""
	statement.OmitStr = ""
	statement.columnMap = make(map[string]bool)
	statement.ConditionStr = ""
	statement.AltTableName = ""
	statement.IdParam = nil
	statement.RawSQL = ""
	statement.RawParams = make([]interface{}, 0)
	statement.BeanArgs = make([]interface{}, 0)
	statement.UseCache = true
	statement.UseAutoTime = true
	statement.IsDistinct = false
	statement.TableAlias = ""
	statement.allUseBool = false
	statement.useAllCols = false
	statement.mustColumnMap = make(map[string]bool)
	statement.checkVersion = true
	statement.unscoped = false
	statement.inColumns = make(map[string]*inParam)
	statement.incrColumns = make(map[string]incrParam)
	statement.decrColumns = make(map[string]decrParam)
	statement.exprColumns = make(map[string]exprParam)
}

// add the raw sql statement
func (statement *Statement) Sql(querystring string, args ...interface{}) *Statement {
	statement.RawSQL = querystring
	statement.RawParams = args
	return statement
}

// set the table alias
func (statement *Statement) Alias(alias string) *Statement {
	statement.TableAlias = alias
	return statement
}

// add Where statment
func (statement *Statement) Where(querystring string, args ...interface{}) *Statement {
	if !strings.Contains(querystring, statement.Engine.dialect.EqStr()) {
		querystring = strings.Replace(querystring, "=", statement.Engine.dialect.EqStr(), -1)
	}
	statement.WhereStr = querystring
	statement.Params = args
	return statement
}

// add Where & and statment
func (statement *Statement) And(querystring string, args ...interface{}) *Statement {
	if statement.WhereStr != "" {
		statement.WhereStr = fmt.Sprintf("(%v) %s (%v)", statement.WhereStr,
			statement.Engine.dialect.AndStr(), querystring)
	} else {
		statement.WhereStr = querystring
	}
	statement.Params = append(statement.Params, args...)
	return statement
}

// add Where & Or statment
func (statement *Statement) Or(querystring string, args ...interface{}) *Statement {
	if statement.WhereStr != "" {
		statement.WhereStr = fmt.Sprintf("(%v) %s (%v)", statement.WhereStr,
			statement.Engine.dialect.OrStr(), querystring)
	} else {
		statement.WhereStr = querystring
	}
	statement.Params = append(statement.Params, args...)
	return statement
}

// tempororily set table name
func (statement *Statement) Table(tableNameOrBean interface{}) *Statement {
	v := rValue(tableNameOrBean)
	t := v.Type()
	if t.Kind() == reflect.String {
		statement.AltTableName = tableNameOrBean.(string)
	} else if t.Kind() == reflect.Struct {
		statement.RefTable = statement.Engine.autoMapType(v)
	}
	return statement
}

/*func (statement *Statement) genFields(bean interface{}) map[string]interface{} {
    results := make(map[string]interface{})
    table := statement.Engine.TableInfo(bean)
    for _, col := range table.Columns {
        fieldValue := col.ValueOf(bean)
        fieldType := reflect.TypeOf(fieldValue.Interface())
        var val interface{}
        switch fieldType.Kind() {
        case reflect.Bool:
            if allUseBool {
                val = fieldValue.Interface()
            } else if _, ok := boolColumnMap[col.Name]; ok {
                val = fieldValue.Interface()
            } else {
                // if a bool in a struct, it will not be as a condition because it default is false,
                // please use Where() instead
                continue
            }
        case reflect.String:
            if fieldValue.String() == "" {
                continue
            }
            // for MyString, should convert to string or panic
            if fieldType.String() != reflect.String.String() {
                val = fieldValue.String()
            } else {
                val = fieldValue.Interface()
            }
        case reflect.Int8, reflect.Int16, reflect.Int, reflect.Int32, reflect.Int64:
            if fieldValue.Int() == 0 {
                continue
            }
            val = fieldValue.Interface()
        case reflect.Float32, reflect.Float64:
            if fieldValue.Float() == 0.0 {
                continue
            }
            val = fieldValue.Interface()
        case reflect.Uint8, reflect.Uint16, reflect.Uint, reflect.Uint32, reflect.Uint64:
            if fieldValue.Uint() == 0 {
                continue
            }
            val = fieldValue.Interface()
        case reflect.Struct:
            if fieldType == reflect.TypeOf(time.Now()) {
                t := fieldValue.Interface().(time.Time)
                if t.IsZero() || !fieldValue.IsValid() {
                    continue
                }
                var str string
                if col.SQLType.Name == Time {
                    s := t.UTC().Format("2006-01-02 15:04:05")
                    val = s[11:19]
                } else if col.SQLType.Name == Date {
                    str = t.Format("2006-01-02")
                    val = str
                } else {
                    val = t
                }
            } else {
                engine.autoMapType(fieldValue.Type())
                if table, ok := engine.Tables[fieldValue.Type()]; ok {
                    pkField := reflect.Indirect(fieldValue).FieldByName(table.PKColumn().FieldName)
                    if pkField.Int() != 0 {
                        val = pkField.Interface()
                    } else {
                        continue
                    }
                } else {
                    val = fieldValue.Interface()
                }
            }
        case reflect.Array, reflect.Slice, reflect.Map:
            if fieldValue == reflect.Zero(fieldType) {
                continue
            }
            if fieldValue.IsNil() || !fieldValue.IsValid() {
                continue
            }

            if col.SQLType.IsText() {
                bytes, err := json.Marshal(fieldValue.Interface())
                if err != nil {
                    engine.LogError(err)
                    continue
                }
                val = string(bytes)
            } else if col.SQLType.IsBlob() {
                var bytes []byte
                var err error
                if (fieldType.Kind() == reflect.Array || fieldType.Kind() == reflect.Slice) &&
                    fieldType.Elem().Kind() == reflect.Uint8 {
                    if fieldValue.Len() > 0 {
                        val = fieldValue.Bytes()
                    } else {
                        continue
                    }
                } else {
                    bytes, err = json.Marshal(fieldValue.Interface())
                    if err != nil {
                        engine.LogError(err)
                        continue
                    }
                    val = bytes
                }
            } else {
                continue
            }
        default:
            val = fieldValue.Interface()
        }
        results[col.Name] = val
    }
    return results
}*/

// Auto generating conditions according a struct
func buildUpdates(engine *Engine, table *core.Table, bean interface{},
	includeVersion bool, includeUpdated bool, includeNil bool,
	includeAutoIncr bool, allUseBool bool, useAllCols bool,
	mustColumnMap map[string]bool, columnMap map[string]bool, update bool) ([]string, []interface{}) {

	colNames := make([]string, 0)
	var args = make([]interface{}, 0)
	for _, col := range table.Columns() {
		if !includeVersion && col.IsVersion {
			continue
		}
		if col.IsCreated {
			continue
		}
		if !includeUpdated && col.IsUpdated {
			continue
		}
		if !includeAutoIncr && col.IsAutoIncrement {
			continue
		}
		if col.IsDeleted {
			continue
		}
		if use, ok := columnMap[col.Name]; ok && !use {
			continue
		}

		if engine.dialect.DBType() == core.MSSQL && col.SQLType.Name == core.Text {
			continue
		}

		fieldValuePtr, err := col.ValueOf(bean)
		if err != nil {
			engine.LogError(err)
			continue
		}

		fieldValue := *fieldValuePtr
		fieldType := reflect.TypeOf(fieldValue.Interface())

		requiredField := useAllCols
		includeNil := useAllCols
		if b, ok := mustColumnMap[strings.ToLower(col.Name)]; ok {
			if b {
				requiredField = true
			} else {
				continue
			}
		}

		var val interface{}

		if fieldValue.CanAddr() {
			if structConvert, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
				data, err := structConvert.ToDB()
				if err != nil {
					engine.LogError(err)
				} else {
					val = data
				}
				goto APPEND
			}
		}

		if structConvert, ok := fieldValue.Interface().(core.Conversion); ok {
			data, err := structConvert.ToDB()
			if err != nil {
				engine.LogError(err)
			} else {
				val = data
			}
			goto APPEND
		}

		if fieldType.Kind() == reflect.Ptr {
			if fieldValue.IsNil() {
				if includeNil {
					args = append(args, nil)
					colNames = append(colNames, fmt.Sprintf("%v=?", engine.Quote(col.Name)))
				}
				continue
			} else if !fieldValue.IsValid() {
				continue
			} else {
				// dereference ptr type to instance type
				fieldValue = fieldValue.Elem()
				fieldType = reflect.TypeOf(fieldValue.Interface())
				requiredField = true
			}
		}

		switch fieldType.Kind() {
		case reflect.Bool:
			if allUseBool || requiredField {
				val = fieldValue.Interface()
			} else {
				// if a bool in a struct, it will not be as a condition because it default is false,
				// please use Where() instead
				continue
			}
		case reflect.String:
			if !requiredField && fieldValue.String() == "" {
				continue
			}
			// for MyString, should convert to string or panic
			if fieldType.String() != reflect.String.String() {
				val = fieldValue.String()
			} else {
				val = fieldValue.Interface()
			}
		case reflect.Int8, reflect.Int16, reflect.Int, reflect.Int32, reflect.Int64:
			if !requiredField && fieldValue.Int() == 0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Float32, reflect.Float64:
			if !requiredField && fieldValue.Float() == 0.0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Uint8, reflect.Uint16, reflect.Uint, reflect.Uint32, reflect.Uint64:
			if !requiredField && fieldValue.Uint() == 0 {
				continue
			}
			t := int64(fieldValue.Uint())
			val = reflect.ValueOf(&t).Interface()
		case reflect.Struct:
			if fieldType == reflect.TypeOf(time.Now()) {
				t := fieldValue.Interface().(time.Time)
				if !requiredField && (t.IsZero() || !fieldValue.IsValid()) {
					continue
				}
				val = engine.FormatTime(col.SQLType.Name, t)
			} else {
				engine.autoMapType(fieldValue)
				if table, ok := engine.Tables[fieldValue.Type()]; ok {
					if len(table.PrimaryKeys) == 1 {
						pkField := reflect.Indirect(fieldValue).FieldByName(table.PKColumns()[0].FieldName)
						// fix non-int pk issues
						//if pkField.Int() != 0 {
						if pkField.IsValid() && !isZero(pkField.Interface()) {
							val = pkField.Interface()
						} else {
							continue
						}
					} else {
						//TODO: how to handler?
						panic("not supported")
					}
				} else {
					val = fieldValue.Interface()
				}
			}
		case reflect.Array, reflect.Slice, reflect.Map:
			if fieldValue == reflect.Zero(fieldType) {
				continue
			}
			if fieldValue.IsNil() || !fieldValue.IsValid() || fieldValue.Len() == 0 {
				continue
			}

			if col.SQLType.IsText() {
				bytes, err := json.Marshal(fieldValue.Interface())
				if err != nil {
					engine.LogError(err)
					continue
				}
				val = string(bytes)
			} else if col.SQLType.IsBlob() {
				var bytes []byte
				var err error
				if (fieldType.Kind() == reflect.Array || fieldType.Kind() == reflect.Slice) &&
					fieldType.Elem().Kind() == reflect.Uint8 {
					if fieldValue.Len() > 0 {
						val = fieldValue.Bytes()
					} else {
						continue
					}
				} else {
					bytes, err = json.Marshal(fieldValue.Interface())
					if err != nil {
						engine.LogError(err)
						continue
					}
					val = bytes
				}
			} else {
				continue
			}
		default:
			val = fieldValue.Interface()
		}

	APPEND:
		//fmt.Println("==", col.Name, "==", fmt.Sprintf("%v", val))
		args = append(args, val)
		if col.IsPrimaryKey && engine.dialect.DBType() == "ql" {
			continue
		}
		colNames = append(colNames, fmt.Sprintf("%v = ?", engine.Quote(col.Name)))
	}

	return colNames, args
}

// Auto generating conditions according a struct
func buildConditions(engine *Engine, table *core.Table, bean interface{},
	includeVersion bool, includeUpdated bool, includeNil bool,
	includeAutoIncr bool, allUseBool bool, useAllCols bool, unscoped bool,
	mustColumnMap map[string]bool) ([]string, []interface{}) {

	colNames := make([]string, 0)
	var args = make([]interface{}, 0)
	for _, col := range table.Columns() {
		if !includeVersion && col.IsVersion {
			continue
		}
		if !includeUpdated && col.IsUpdated {
			continue
		}
		if !includeAutoIncr && col.IsAutoIncrement {
			continue
		}

		if engine.dialect.DBType() == core.MSSQL && col.SQLType.Name == core.Text {
			continue
		}
		fieldValuePtr, err := col.ValueOf(bean)
		if err != nil {
			engine.LogError(err)
			continue
		}

		if col.IsDeleted && !unscoped { // tag "deleted" is enabled
			colNames = append(colNames, fmt.Sprintf("(%v IS NULL or %v = '0001-01-01 00:00:00')", engine.Quote(col.Name), engine.Quote(col.Name)))
		}

		fieldValue := *fieldValuePtr
		if fieldValue.Interface() == nil {
			continue
		}

		fieldType := reflect.TypeOf(fieldValue.Interface())
		requiredField := useAllCols
		if b, ok := mustColumnMap[strings.ToLower(col.Name)]; ok {
			if b {
				requiredField = true
			} else {
				continue
			}
		}

		if fieldType.Kind() == reflect.Ptr {
			if fieldValue.IsNil() {
				if includeNil {
					args = append(args, nil)
					colNames = append(colNames, fmt.Sprintf("%v %s ?", engine.Quote(col.Name), engine.dialect.EqStr()))
				}
				continue
			} else if !fieldValue.IsValid() {
				continue
			} else {
				// dereference ptr type to instance type
				fieldValue = fieldValue.Elem()
				fieldType = reflect.TypeOf(fieldValue.Interface())
				requiredField = true
			}
		}

		var val interface{}
		switch fieldType.Kind() {
		case reflect.Bool:
			if allUseBool || requiredField {
				val = fieldValue.Interface()
			} else {
				// if a bool in a struct, it will not be as a condition because it default is false,
				// please use Where() instead
				continue
			}
		case reflect.String:
			if !requiredField && fieldValue.String() == "" {
				continue
			}
			// for MyString, should convert to string or panic
			if fieldType.String() != reflect.String.String() {
				val = fieldValue.String()
			} else {
				val = fieldValue.Interface()
			}
		case reflect.Int8, reflect.Int16, reflect.Int, reflect.Int32, reflect.Int64:
			if !requiredField && fieldValue.Int() == 0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Float32, reflect.Float64:
			if !requiredField && fieldValue.Float() == 0.0 {
				continue
			}
			val = fieldValue.Interface()
		case reflect.Uint8, reflect.Uint16, reflect.Uint, reflect.Uint32, reflect.Uint64:
			if !requiredField && fieldValue.Uint() == 0 {
				continue
			}
			t := int64(fieldValue.Uint())
			val = reflect.ValueOf(&t).Interface()
		case reflect.Struct:
			if fieldType.ConvertibleTo(core.TimeType) {
				t := fieldValue.Convert(core.TimeType).Interface().(time.Time)
				if !requiredField && (t.IsZero() || !fieldValue.IsValid()) {
					continue
				}
				val = engine.FormatTime(col.SQLType.Name, t)
			} else if _, ok := reflect.New(fieldType).Interface().(core.Conversion); ok {
				continue
			} else {
				engine.autoMapType(fieldValue)
				if table, ok := engine.Tables[fieldValue.Type()]; ok {
					if len(table.PrimaryKeys) == 1 {
						pkField := reflect.Indirect(fieldValue).FieldByName(table.PKColumns()[0].FieldName)
						// fix non-int pk issues
						//if pkField.Int() != 0 {
						if pkField.IsValid() && !isZero(pkField.Interface()) {
							val = pkField.Interface()
						} else {
							continue
						}
					} else {
						//TODO: how to handler?
						panic("not supported")
					}
				} else {
					val = fieldValue.Interface()
				}
			}
		case reflect.Array, reflect.Slice, reflect.Map:
			if fieldValue == reflect.Zero(fieldType) {
				continue
			}
			if fieldValue.IsNil() || !fieldValue.IsValid() || fieldValue.Len() == 0 {
				continue
			}

			if col.SQLType.IsText() {
				bytes, err := json.Marshal(fieldValue.Interface())
				if err != nil {
					engine.LogError(err)
					continue
				}
				val = string(bytes)
			} else if col.SQLType.IsBlob() {
				var bytes []byte
				var err error
				if (fieldType.Kind() == reflect.Array || fieldType.Kind() == reflect.Slice) &&
					fieldType.Elem().Kind() == reflect.Uint8 {
					if fieldValue.Len() > 0 {
						val = fieldValue.Bytes()
					} else {
						continue
					}
				} else {
					bytes, err = json.Marshal(fieldValue.Interface())
					if err != nil {
						engine.LogError(err)
						continue
					}
					val = bytes
				}
			} else {
				continue
			}
		default:
			val = fieldValue.Interface()
		}

		args = append(args, val)
		var condi string
		if col.IsPrimaryKey && engine.dialect.DBType() == "ql" {
			condi = "id() == ?"
		} else {
			condi = fmt.Sprintf("%v %s ?", engine.Quote(col.Name), engine.dialect.EqStr())
		}
		colNames = append(colNames, condi)
	}

	return colNames, args
}

// return current tableName
func (statement *Statement) TableName() string {
	if statement.AltTableName != "" {
		return statement.AltTableName
	}

	if statement.RefTable != nil {
		return statement.RefTable.Name
	}
	return ""
}

var (
	ptrPkType = reflect.TypeOf(&core.PK{})
	pkType    = reflect.TypeOf(core.PK{})
)

// Generate "where id = ? " statment or for composite key "where key1 = ? and key2 = ?"
func (statement *Statement) Id(id interface{}) *Statement {
	idValue := reflect.ValueOf(id)
	idType := reflect.TypeOf(idValue.Interface())

	switch idType {
	case ptrPkType:
		if pkPtr, ok := (id).(*core.PK); ok {
			statement.IdParam = pkPtr
		}
	case pkType:
		if pk, ok := (id).(core.PK); ok {
			statement.IdParam = &pk
		}
	default:
		// TODO: treat as int primitve for now, need to handle type check?
		statement.IdParam = &core.PK{id}
	}

	return statement
}

// Generate  "Update ... Set column = column + arg" statment
func (statement *Statement) Incr(column string, arg ...interface{}) *Statement {
	k := strings.ToLower(column)
	if len(arg) > 0 {
		statement.incrColumns[k] = incrParam{column, arg[0]}
	} else {
		statement.incrColumns[k] = incrParam{column, 1}
	}
	return statement
}

// Generate  "Update ... Set column = column - arg" statment
func (statement *Statement) Decr(column string, arg ...interface{}) *Statement {
	k := strings.ToLower(column)
	if len(arg) > 0 {
		statement.decrColumns[k] = decrParam{column, arg[0]}
	} else {
		statement.decrColumns[k] = decrParam{column, 1}
	}
	return statement
}

// Generate  "Update ... Set column = {expression}" statment
func (statement *Statement) SetExpr(column string, expression string) *Statement {
	k := strings.ToLower(column)
	statement.exprColumns[k] = exprParam{column, expression}
	return statement
}

// Generate  "Update ... Set column = column + arg" statment
func (statement *Statement) getInc() map[string]incrParam {
	return statement.incrColumns
}

// Generate  "Update ... Set column = column - arg" statment
func (statement *Statement) getDec() map[string]decrParam {
	return statement.decrColumns
}

// Generate  "Update ... Set column = {expression}" statment
func (statement *Statement) getExpr() map[string]exprParam {
	return statement.exprColumns
}

// Generate "Where column IN (?) " statment
func (statement *Statement) In(column string, args ...interface{}) *Statement {
	k := strings.ToLower(column)
	var newargs []interface{}
	if len(args) == 1 &&
		reflect.TypeOf(args[0]).Kind() == reflect.Slice {
		newargs = make([]interface{}, 0)
		v := reflect.ValueOf(args[0])
		for i := 0; i < v.Len(); i++ {
			newargs = append(newargs, v.Index(i).Interface())
		}
	} else {
		newargs = args
	}

	if _, ok := statement.inColumns[k]; ok {
		statement.inColumns[k].args = append(statement.inColumns[k].args, newargs...)
	} else {
		statement.inColumns[k] = &inParam{column, newargs}
	}
	return statement
}

func (statement *Statement) genInSql() (string, []interface{}) {
	if len(statement.inColumns) == 0 {
		return "", []interface{}{}
	}

	inStrs := make([]string, 0, len(statement.inColumns))
	args := make([]interface{}, 0)
	for _, params := range statement.inColumns {
		inStrs = append(inStrs, fmt.Sprintf("(%v IN (%v))",
			statement.Engine.autoQuote(params.colName),
			strings.Join(makeArray("?", len(params.args)), ",")))
		args = append(args, params.args...)
	}

	if len(statement.inColumns) == 1 {
		return inStrs[0], args
	}
	return fmt.Sprintf("(%v)", strings.Join(inStrs, " "+statement.Engine.dialect.AndStr()+" ")), args
}

func (statement *Statement) attachInSql() {
	inSql, inArgs := statement.genInSql()
	if len(inSql) > 0 {
		if statement.ConditionStr != "" {
			statement.ConditionStr += " " + statement.Engine.dialect.AndStr() + " "
		}
		statement.ConditionStr += inSql
		statement.Params = append(statement.Params, inArgs...)
	}
}

func col2NewCols(columns ...string) []string {
	newColumns := make([]string, 0)
	for _, col := range columns {
		col = strings.Replace(col, "`", "", -1)
		col = strings.Replace(col, `"`, "", -1)
		ccols := strings.Split(col, ",")
		for _, c := range ccols {
			newColumns = append(newColumns, strings.TrimSpace(c))
		}
	}
	return newColumns
}

func (engine *Engine) autoQuote(col string) string {
	col = strings.Replace(col, "`", "", -1)
	col = strings.Replace(col, engine.QuoteStr(), "", -1)
	fields := strings.Split(strings.TrimSpace(col), ".")
	for i, field := range fields {
		fields[i] = engine.Quote(field)
	}
	return strings.Join(fields, ".")
}

func (statement *Statement) col2NewColsWithQuote(columns ...string) []string {
	newColumns := make([]string, 0)
	for _, col := range columns {
		col = strings.Replace(col, "`", "", -1)
		col = strings.Replace(col, statement.Engine.QuoteStr(), "", -1)
		ccols := strings.Split(col, ",")
		for _, c := range ccols {
			fields := strings.Split(strings.TrimSpace(c), ".")
			if len(fields) == 1 {
				newColumns = append(newColumns, statement.Engine.Quote(fields[0]))
			} else if len(fields) == 2 {
				newColumns = append(newColumns, statement.Engine.Quote(fields[0])+"."+
					statement.Engine.Quote(fields[1]))
			} else {
				panic(errors.New("unwanted colnames"))
			}
		}
	}
	return newColumns
}

// Generate "Distince col1, col2 " statment
func (statement *Statement) Distinct(columns ...string) *Statement {
	statement.IsDistinct = true
	statement.Cols(columns...)
	return statement
}

// Generate "col1, col2" statement
func (statement *Statement) Cols(columns ...string) *Statement {
	newColumns := col2NewCols(columns...)
	for _, nc := range newColumns {
		statement.columnMap[strings.ToLower(nc)] = true
	}
	statement.ColumnStr = statement.Engine.Quote(strings.Join(newColumns, statement.Engine.Quote(", ")))
	if strings.Contains(statement.ColumnStr, ".") {
		statement.ColumnStr = strings.Replace(statement.ColumnStr, ".", statement.Engine.Quote("."), -1)
	}
	return statement
}

// Update use only: update all columns
func (statement *Statement) AllCols() *Statement {
	statement.useAllCols = true
	return statement
}

// Update use only: must update columns
func (statement *Statement) MustCols(columns ...string) *Statement {
	newColumns := col2NewCols(columns...)
	for _, nc := range newColumns {
		statement.mustColumnMap[strings.ToLower(nc)] = true
	}
	return statement
}

// Update use only: not update columns
/*func (statement *Statement) NotCols(columns ...string) *Statement {
	newColumns := col2NewCols(columns...)
	for _, nc := range newColumns {
		statement.mustColumnMap[strings.ToLower(nc)] = false
	}
	return statement
}*/

// indicates that use bool fields as update contents and query contiditions
func (statement *Statement) UseBool(columns ...string) *Statement {
	if len(columns) > 0 {
		statement.MustCols(columns...)
	} else {
		statement.allUseBool = true
	}
	return statement
}

// do not use the columns
func (statement *Statement) Omit(columns ...string) {
	newColumns := col2NewCols(columns...)
	for _, nc := range newColumns {
		statement.columnMap[strings.ToLower(nc)] = false
	}
	statement.OmitStr = statement.Engine.Quote(strings.Join(newColumns, statement.Engine.Quote(", ")))
}

// Generate LIMIT limit statement
func (statement *Statement) Top(limit int) *Statement {
	statement.Limit(limit)
	return statement
}

// Generate LIMIT start, limit statement
func (statement *Statement) Limit(limit int, start ...int) *Statement {
	statement.LimitN = limit
	if len(start) > 0 {
		statement.Start = start[0]
	}
	return statement
}

// Generate "Order By order" statement
func (statement *Statement) OrderBy(order string) *Statement {
	if statement.OrderStr != "" {
		statement.OrderStr += ", "
	}
	statement.OrderStr += order
	return statement
}

func (statement *Statement) Desc(colNames ...string) *Statement {
	if statement.OrderStr != "" {
		statement.OrderStr += ", "
	}
	newColNames := statement.col2NewColsWithQuote(colNames...)
	sqlStr := strings.Join(newColNames, " DESC, ")
	statement.OrderStr += sqlStr + " DESC"
	return statement
}

// Method Asc provide asc order by query condition, the input parameters are columns.
func (statement *Statement) Asc(colNames ...string) *Statement {
	if statement.OrderStr != "" {
		statement.OrderStr += ", "
	}
	newColNames := statement.col2NewColsWithQuote(colNames...)
	sqlStr := strings.Join(newColNames, " ASC, ")
	statement.OrderStr += sqlStr + " ASC"
	return statement
}

//The join_operator should be one of INNER, LEFT OUTER, CROSS etc - this will be prepended to JOIN
func (statement *Statement) Join(join_operator string, tablename interface{}, condition string) *Statement {
	var joinTable string
	switch tablename.(type) {
	case []string:
		t := tablename.([]string)
		l := len(t)
		if l > 1 {
			table := t[0]
			joinTable = statement.Engine.Quote(table) + " AS " + statement.Engine.Quote(t[1])
		} else if l == 1 {
			table := t[0]
			joinTable = statement.Engine.Quote(table)
		}
	case []interface{}:
		t := tablename.([]interface{})
		l := len(t)
		table := ""
		if l > 0 {
			f := t[0]
			v := rValue(f)
			t := v.Type()
			if t.Kind() == reflect.String {
				table = f.(string)
			} else if t.Kind() == reflect.Struct {
				r := statement.Engine.autoMapType(v)
				table = r.Name
			}
		}
		if l > 1 {
			joinTable = statement.Engine.Quote(table) + " AS " + statement.Engine.Quote(fmt.Sprintf("%v", t[1]))
		} else if l == 1 {
			joinTable = statement.Engine.Quote(table)
		}
	default:
		t := fmt.Sprintf("%v", tablename)
		joinTable = statement.Engine.Quote(t)
	}
	if statement.JoinStr != "" {
		statement.JoinStr = statement.JoinStr + fmt.Sprintf(" %v JOIN %v ON %v", join_operator,
			joinTable, condition)
	} else {
		statement.JoinStr = fmt.Sprintf("%v JOIN %v ON %v", join_operator,
			joinTable, condition)
	}
	return statement
}

// Generate "Group By keys" statement
func (statement *Statement) GroupBy(keys string) *Statement {
	statement.GroupByStr = keys
	return statement
}

// Generate "Having conditions" statement
func (statement *Statement) Having(conditions string) *Statement {
	statement.HavingStr = fmt.Sprintf("HAVING %v", conditions)
	return statement
}

// Always disable struct tag "deleted"
func (statement *Statement) Unscoped() *Statement {
	statement.unscoped = true
	return statement
}

func (statement *Statement) genColumnStr() string {
	table := statement.RefTable
	colNames := make([]string, 0)
	for _, col := range table.Columns() {
		if statement.OmitStr != "" {
			if _, ok := statement.columnMap[strings.ToLower(col.Name)]; ok {
				continue
			}
		}
		if col.MapType == core.ONLYTODB {
			continue
		}

		if statement.JoinStr != "" {
			var name string
			if statement.TableAlias != "" {
				name = statement.Engine.Quote(statement.TableAlias)
			} else {
				name = statement.Engine.Quote(statement.TableName())
			}
			name += "." + statement.Engine.Quote(col.Name)
			if col.IsPrimaryKey && statement.Engine.Dialect().DBType() == "ql" {
				colNames = append(colNames, "id() AS "+name)
			} else {
				colNames = append(colNames, name)
			}
		} else {
			name := statement.Engine.Quote(col.Name)
			if col.IsPrimaryKey && statement.Engine.Dialect().DBType() == "ql" {
				colNames = append(colNames, "id() AS "+name)
			} else {
				colNames = append(colNames, name)
			}
		}
	}
	return strings.Join(colNames, ", ")
}

func (statement *Statement) genCreateTableSQL() string {
	return statement.Engine.dialect.CreateTableSql(statement.RefTable, statement.AltTableName,
		statement.StoreEngine, statement.Charset)
}

func indexName(tableName, idxName string) string {
	return fmt.Sprintf("IDX_%v_%v", tableName, idxName)
}

func (s *Statement) genIndexSQL() []string {
	var sqls []string = make([]string, 0)
	tbName := s.TableName()
	quote := s.Engine.Quote
	for idxName, index := range s.RefTable.Indexes {
		if index.Type == core.IndexType {
			sql := fmt.Sprintf("CREATE INDEX %v ON %v (%v);", quote(indexName(tbName, idxName)),
				quote(tbName), quote(strings.Join(index.Cols, quote(","))))
			sqls = append(sqls, sql)
		}
	}
	return sqls
}

func uniqueName(tableName, uqeName string) string {
	return fmt.Sprintf("UQE_%v_%v", tableName, uqeName)
}

func (s *Statement) genUniqueSQL() []string {
	var sqls []string = make([]string, 0)
	tbName := s.TableName()
	for _, index := range s.RefTable.Indexes {
		if index.Type == core.UniqueType {
			sql := s.Engine.dialect.CreateIndexSql(tbName, index)
			sqls = append(sqls, sql)
		}
	}
	return sqls
}

func (s *Statement) genDelIndexSQL() []string {
	var sqls []string = make([]string, 0)
	for idxName, index := range s.RefTable.Indexes {
		var rIdxName string
		if index.Type == core.UniqueType {
			rIdxName = uniqueName(s.TableName(), idxName)
		} else if index.Type == core.IndexType {
			rIdxName = indexName(s.TableName(), idxName)
		}
		sql := fmt.Sprintf("DROP INDEX %v", s.Engine.Quote(rIdxName))
		if s.Engine.dialect.IndexOnTable() {
			sql += fmt.Sprintf(" ON %v", s.Engine.Quote(s.TableName()))
		}
		sqls = append(sqls, sql)
	}
	return sqls
}

/*
func (s *Statement) genDropSQL() string {
	return s.Engine.dialect.MustDropTa(s.TableName()) + ";"
}*/

func (statement *Statement) genGetSql(bean interface{}) (string, []interface{}) {
	var table *core.Table
	if statement.RefTable == nil {
		table = statement.Engine.TableInfo(bean)
		statement.RefTable = table
	} else {
		table = statement.RefTable
	}

	colNames, args := buildConditions(statement.Engine, table, bean, true, true,
		false, true, statement.allUseBool, statement.useAllCols,
		statement.unscoped, statement.mustColumnMap)

	statement.ConditionStr = strings.Join(colNames, " "+statement.Engine.dialect.AndStr()+" ")
	statement.BeanArgs = args

	var columnStr string = statement.ColumnStr
	if len(statement.JoinStr) == 0 {
		if len(columnStr) == 0 {
			if statement.GroupByStr != "" {
				columnStr = statement.Engine.Quote(strings.Replace(statement.GroupByStr, ",", statement.Engine.Quote(","), -1))
			} else {
				columnStr = statement.genColumnStr()
			}
		}
	} else {
		if len(columnStr) == 0 {
			if statement.GroupByStr != "" {
				columnStr = statement.Engine.Quote(strings.Replace(statement.GroupByStr, ",", statement.Engine.Quote(","), -1))
			} else {
				columnStr = "*"
			}
		}
	}

	statement.attachInSql() // !admpub!  fix bug:Iterate func missing "... IN (...)"
	return statement.genSelectSql(columnStr), append(statement.Params, statement.BeanArgs...)
}

func (s *Statement) genAddColumnStr(col *core.Column) (string, []interface{}) {
	quote := s.Engine.Quote
	sql := fmt.Sprintf("ALTER TABLE %v ADD %v;", quote(s.TableName()),
		col.String(s.Engine.dialect))
	return sql, []interface{}{}
}

/*func (s *Statement) genAddIndexStr(idxName string, cols []string) (string, []interface{}) {
	quote := s.Engine.Quote
	colstr := quote(strings.Join(cols, quote(", ")))
	sql := fmt.Sprintf("CREATE INDEX %v ON %v (%v);", quote(idxName), quote(s.TableName()), colstr)
	return sql, []interface{}{}
}

func (s *Statement) genAddUniqueStr(uqeName string, cols []string) (string, []interface{}) {
	quote := s.Engine.Quote
	colstr := quote(strings.Join(cols, quote(", ")))
	sql := fmt.Sprintf("CREATE UNIQUE INDEX %v ON %v (%v);", quote(uqeName), quote(s.TableName()), colstr)
	return sql, []interface{}{}
}*/

func (statement *Statement) genCountSql(bean interface{}) (string, []interface{}) {
	table := statement.Engine.TableInfo(bean)
	statement.RefTable = table

	colNames, args := buildConditions(statement.Engine, table, bean, true, true, false,
		true, statement.allUseBool, statement.useAllCols,
		statement.unscoped, statement.mustColumnMap)

	statement.ConditionStr = strings.Join(colNames, " "+statement.Engine.Dialect().AndStr()+" ")
	statement.BeanArgs = args

	// count(index fieldname) > count(0) > count(*)
	var id string = "*"
	if statement.Engine.Dialect().DBType() == "ql" {
		id = ""
	}
	statement.attachInSql()
	return statement.genSelectSql(fmt.Sprintf("count(%v)", id)), append(statement.Params, statement.BeanArgs...)
}

func (statement *Statement) genSelectSql(columnStr string) (a string) {
	/*if statement.GroupByStr != "" {
		if columnStr == "" {
			columnStr = statement.Engine.Quote(strings.Replace(statement.GroupByStr, ",", statement.Engine.Quote(","), -1))
		}
		//statement.GroupByStr = columnStr
	}*/
	var distinct string
	if statement.IsDistinct {
		distinct = "DISTINCT "
	}

	var top string
	var mssqlCondi string
	/*var orderBy string
	if statement.OrderStr != "" {
		orderBy = fmt.Sprintf(" ORDER BY %v", statement.OrderStr)
	}*/
	statement.processIdParam()
	var whereStr string
	if statement.WhereStr != "" {
		whereStr = fmt.Sprintf(" WHERE %v", statement.WhereStr)
		if statement.ConditionStr != "" {
			whereStr = fmt.Sprintf("%v %s %v", whereStr, statement.Engine.Dialect().AndStr(),
				statement.ConditionStr)
		}
	} else if statement.ConditionStr != "" {
		whereStr = fmt.Sprintf(" WHERE %v", statement.ConditionStr)
	}
	var fromStr string = " FROM " + statement.Engine.Quote(statement.TableName())
	if statement.TableAlias != "" {
		if statement.Engine.dialect.DBType() == core.ORACLE {
			fromStr += " " + statement.Engine.Quote(statement.TableAlias)
		} else {
			fromStr += " AS " + statement.Engine.Quote(statement.TableAlias)
		}
	}
	if statement.JoinStr != "" {
		fromStr = fmt.Sprintf("%v %v", fromStr, statement.JoinStr)
	}

	if statement.Engine.dialect.DBType() == core.MSSQL {
		if statement.LimitN > 0 {
			top = fmt.Sprintf(" TOP %d ", statement.LimitN)
		}
		if statement.Start > 0 {
			var column string = "(id)"
			if len(statement.RefTable.PKColumns()) == 0 {
				for _, index := range statement.RefTable.Indexes {
					if len(index.Cols) == 1 {
						column = index.Cols[0]
						break
					}
				}
				if len(column) == 0 {
					column = statement.RefTable.ColumnsSeq()[0]
				}
			}
			var orderStr string
			if len(statement.OrderStr) > 0 {
				orderStr = " ORDER BY " + statement.OrderStr
			}
			var groupStr string
			if len(statement.GroupByStr) > 0 {
				groupStr = " GROUP BY " + statement.GroupByStr
			}
			mssqlCondi = fmt.Sprintf("(%s NOT IN (SELECT TOP %d %s%s%s%s%s))",
				column, statement.Start, column, fromStr, whereStr, orderStr, groupStr)
		}
	}

	// !nashtsai! REVIEW Sprintf is considered slowest mean of string concatnation, better to work with builder pattern
	a = fmt.Sprintf("SELECT %v%v%v%v%v", top, distinct, columnStr,
		fromStr, whereStr)
	if mssqlCondi != "" {
		if whereStr != "" {
			a += " AND " + mssqlCondi
		} else {
			a += " WHERE " + mssqlCondi
		}
	}

	if statement.GroupByStr != "" {
		a = fmt.Sprintf("%v GROUP BY %v", a, statement.GroupByStr)
	}
	if statement.HavingStr != "" {
		a = fmt.Sprintf("%v %v", a, statement.HavingStr)
	}
	if statement.OrderStr != "" {
		a = fmt.Sprintf("%v ORDER BY %v", a, statement.OrderStr)
	}
	if statement.Engine.dialect.DBType() != core.MSSQL && statement.Engine.dialect.DBType() != core.ORACLE {
		if statement.Start > 0 {
			a = fmt.Sprintf("%v LIMIT %v OFFSET %v", a, statement.LimitN, statement.Start)
		} else if statement.LimitN > 0 {
			a = fmt.Sprintf("%v LIMIT %v", a, statement.LimitN)
		}
	} else if statement.Engine.dialect.DBType() == core.ORACLE {
		if statement.Start != 0 || statement.LimitN != 0 {
			a = fmt.Sprintf("SELECT %v FROM (SELECT %v,ROWNUM RN FROM (%v) at WHERE ROWNUM <= %d) aat WHERE RN > %d", columnStr, columnStr, a, statement.Start+statement.LimitN, statement.Start)
		}
	}

	return
}

func (statement *Statement) processIdParam() {
	if statement.IdParam != nil {
		if statement.Engine.dialect.DBType() != "ql" {
			for i, col := range statement.RefTable.PKColumns() {
				if i < len(*(statement.IdParam)) {
					statement.And(fmt.Sprintf("%v %s ?", statement.Engine.Quote(col.Name),
						statement.Engine.dialect.EqStr()), (*(statement.IdParam))[i])
				} else {
					statement.And(fmt.Sprintf("%v %s ?", statement.Engine.Quote(col.Name),
						statement.Engine.dialect.EqStr()), "")
				}
			}
		} else {
			if len(*(statement.IdParam)) <= 1 {
				statement.And("id() == ?", (*(statement.IdParam))[0])
			}
		}
	}
}
