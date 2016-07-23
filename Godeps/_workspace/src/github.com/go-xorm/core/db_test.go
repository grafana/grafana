package core

import (
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/mattn/go-sqlite3"
)

var (
	//dbtype         string = "sqlite3"
	dbtype         string = "mysql"
	createTableSql string
)

type User struct {
	Id       int64
	Name     string
	Title    string
	Age      float32
	Alias    string
	NickName string
	Created  NullTime
}

func init() {
	switch dbtype {
	case "sqlite3":
		createTableSql = "CREATE TABLE IF NOT EXISTS `user` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, `name` TEXT NULL, " +
			"`title` TEXT NULL, `age` FLOAT NULL, `alias` TEXT NULL, `nick_name` TEXT NULL, `created` datetime);"
	case "mysql":
		createTableSql = "CREATE TABLE IF NOT EXISTS `user` (`id` INTEGER PRIMARY KEY AUTO_INCREMENT NOT NULL, `name` TEXT NULL, " +
			"`title` TEXT NULL, `age` FLOAT NULL, `alias` TEXT NULL, `nick_name` TEXT NULL, `created` datetime);"
	default:
		panic("no db type")
	}
}

func testOpen() (*DB, error) {
	switch dbtype {
	case "sqlite3":
		os.Remove("./test.db")
		return Open("sqlite3", "./test.db")
	case "mysql":
		return Open("mysql", "root:@/core_test?charset=utf8")
	default:
		panic("no db type")
	}
}

func BenchmarkOriQuery(b *testing.B) {
	b.StopTimer()
	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (`name`, title, age, alias, nick_name, created) values (?,?,?,?,?, ?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			var Id int64
			var Name, Title, Alias, NickName string
			var Age float32
			var Created NullTime
			err = rows.Scan(&Id, &Name, &Title, &Age, &Alias, &NickName, &Created)
			if err != nil {
				b.Error(err)
			}
			//fmt.Println(Id, Name, Title, Age, Alias, NickName)
		}
		rows.Close()
	}
}

func BenchmarkStructQuery(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (`name`, title, age, alias, nick_name, created) values (?,?,?,?,?, ?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			var user User
			err = rows.ScanStructByIndex(&user)
			if err != nil {
				b.Error(err)
			}
			if user.Name != "xlw" {
				fmt.Println(user)
				b.Error(errors.New("name should be xlw"))
			}
		}
		rows.Close()
	}
}

func BenchmarkStruct2Query(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (`name`, title, age, alias, nick_name, created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	db.Mapper = NewCacheMapper(&SnakeMapper{})
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			var user User
			err = rows.ScanStructByName(&user)
			if err != nil {
				b.Error(err)
			}
			if user.Name != "xlw" {
				fmt.Println(user)
				b.Error(errors.New("name should be xlw"))
			}
		}
		rows.Close()
	}
}

func BenchmarkSliceInterfaceQuery(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (`name`, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		cols, err := rows.Columns()
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			slice := make([]interface{}, len(cols))
			err = rows.ScanSlice(&slice)
			if err != nil {
				b.Error(err)
			}
			fmt.Println(slice)
			if *slice[1].(*string) != "xlw" {
				fmt.Println(slice)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}

/*func BenchmarkSliceBytesQuery(b *testing.B) {
	b.StopTimer()
	os.Remove("./test.db")
	db, err := Open("sqlite3", "./test.db")
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (name, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		cols, err := rows.Columns()
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			slice := make([][]byte, len(cols))
			err = rows.ScanSlice(&slice)
			if err != nil {
				b.Error(err)
			}
			if string(slice[1]) != "xlw" {
				fmt.Println(slice)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}
*/

func BenchmarkSliceStringQuery(b *testing.B) {
	b.StopTimer()
	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (name, title, age, alias, nick_name, created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		cols, err := rows.Columns()
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			slice := make([]*string, len(cols))
			err = rows.ScanSlice(&slice)
			if err != nil {
				b.Error(err)
			}
			if (*slice[1]) != "xlw" {
				fmt.Println(slice)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}

func BenchmarkMapInterfaceQuery(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (name, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			m := make(map[string]interface{})
			err = rows.ScanMap(&m)
			if err != nil {
				b.Error(err)
			}
			if m["name"].(string) != "xlw" {
				fmt.Println(m)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}

/*func BenchmarkMapBytesQuery(b *testing.B) {
	b.StopTimer()
	os.Remove("./test.db")
	db, err := Open("sqlite3", "./test.db")
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (name, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			m := make(map[string][]byte)
			err = rows.ScanMap(&m)
			if err != nil {
				b.Error(err)
			}
			if string(m["name"]) != "xlw" {
				fmt.Println(m)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}
*/
/*
func BenchmarkMapStringQuery(b *testing.B) {
	b.StopTimer()
	os.Remove("./test.db")
	db, err := Open("sqlite3", "./test.db")
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	for i := 0; i < 50; i++ {
		_, err = db.Exec("insert into user (name, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		rows, err := db.Query("select * from user")
		if err != nil {
			b.Error(err)
		}

		for rows.Next() {
			m := make(map[string]string)
			err = rows.ScanMap(&m)
			if err != nil {
				b.Error(err)
			}
			if m["name"] != "xlw" {
				fmt.Println(m)
				b.Error(errors.New("name should be xlw"))
			}
		}

		rows.Close()
	}
}*/

func BenchmarkExec(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		_, err = db.Exec("insert into user (`name`, title, age, alias, nick_name,created) values (?,?,?,?,?,?)",
			"xlw", "tester", 1.2, "lunny", "lunny xiao", time.Now())
		if err != nil {
			b.Error(err)
		}
	}
}

func BenchmarkExecMap(b *testing.B) {
	b.StopTimer()

	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	b.StartTimer()

	mp := map[string]interface{}{
		"name":      "xlw",
		"title":     "tester",
		"age":       1.2,
		"alias":     "lunny",
		"nick_name": "lunny xiao",
		"created":   time.Now(),
	}

	for i := 0; i < b.N; i++ {
		_, err = db.ExecMap("insert into user (`name`, title, age, alias, nick_name, created) "+
			"values (?name,?title,?age,?alias,?nick_name,?created)",
			&mp)
		if err != nil {
			b.Error(err)
		}
	}
}

func TestExecMap(t *testing.T) {
	db, err := testOpen()
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		t.Error(err)
	}

	mp := map[string]interface{}{
		"name":      "xlw",
		"title":     "tester",
		"age":       1.2,
		"alias":     "lunny",
		"nick_name": "lunny xiao",
		"created":   time.Now(),
	}

	_, err = db.ExecMap("insert into user (`name`, title, age, alias, nick_name,created) "+
		"values (?name,?title,?age,?alias,?nick_name,?created)",
		&mp)
	if err != nil {
		t.Error(err)
	}

	rows, err := db.Query("select * from user")
	if err != nil {
		t.Error(err)
	}

	for rows.Next() {
		var user User
		err = rows.ScanStructByName(&user)
		if err != nil {
			t.Error(err)
		}
		fmt.Println("--", user)
	}
}

func TestExecStruct(t *testing.T) {
	db, err := testOpen()
	if err != nil {
		t.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		t.Error(err)
	}

	user := User{Name: "xlw",
		Title:    "tester",
		Age:      1.2,
		Alias:    "lunny",
		NickName: "lunny xiao",
		Created:  NullTime(time.Now()),
	}

	_, err = db.ExecStruct("insert into user (`name`, title, age, alias, nick_name,created) "+
		"values (?Name,?Title,?Age,?Alias,?NickName,?Created)",
		&user)
	if err != nil {
		t.Error(err)
	}

	rows, err := db.QueryStruct("select * from user where `name` = ?Name", &user)
	if err != nil {
		t.Error(err)
	}

	for rows.Next() {
		var user User
		err = rows.ScanStructByName(&user)
		if err != nil {
			t.Error(err)
		}
		fmt.Println("1--", user)
	}
}

func BenchmarkExecStruct(b *testing.B) {
	b.StopTimer()
	db, err := testOpen()
	if err != nil {
		b.Error(err)
	}
	defer db.Close()

	_, err = db.Exec(createTableSql)
	if err != nil {
		b.Error(err)
	}

	b.StartTimer()

	user := User{Name: "xlw",
		Title:    "tester",
		Age:      1.2,
		Alias:    "lunny",
		NickName: "lunny xiao",
		Created:  NullTime(time.Now()),
	}

	for i := 0; i < b.N; i++ {
		_, err = db.ExecStruct("insert into user (`name`, title, age, alias, nick_name,created) "+
			"values (?Name,?Title,?Age,?Alias,?NickName,?Created)",
			&user)
		if err != nil {
			b.Error(err)
		}
	}
}
