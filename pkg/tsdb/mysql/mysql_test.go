package mysql

import (
	"testing"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

// To run this test, remove the Skip from SkipConvey
// and set up a MySQL db named grafana_tests and a user/password grafana/password
func TestMySQL(t *testing.T) {
	SkipConvey("MySQL", t, func() {
		x := InitMySQLTestDB(t)

		executor := &MysqlExecutor{
			engine: x,
			log:    log.New("tsdb.mysql"),
		}

		sess := x.NewSession()
		defer sess.Close()
		db := sess.DB()

		sql := "CREATE TABLE `mysql_types` ("
		sql += "`atinyint` tinyint(1),"
		sql += "`avarchar` varchar(3),"
		sql += "`achar` char(3),"
		sql += "`amediumint` mediumint,"
		sql += "`asmallint` smallint,"
		sql += "`abigint` bigint,"
		sql += "`aint` int(11),"
		sql += "`adouble` double(10,2),"
		sql += "`anewdecimal` decimal(10,2),"
		sql += "`afloat` float(10,2),"
		sql += "`atimestamp` timestamp NOT NULL,"
		sql += "`adatetime` datetime,"
		sql += "`atime` time,"
		// sql += "`ayear` year," // Crashes xorm when running cleandb
		sql += "`abit` bit(1),"
		sql += "`atinytext` tinytext,"
		sql += "`atinyblob` tinyblob,"
		sql += "`atext` text,"
		sql += "`ablob` blob,"
		sql += "`amediumtext` mediumtext,"
		sql += "`amediumblob` mediumblob,"
		sql += "`alongtext` longtext,"
		sql += "`alongblob` longblob,"
		sql += "`aenum` enum('val1', 'val2'),"
		sql += "`aset` set('a', 'b', 'c', 'd'),"
		sql += "`adate` date"
		sql += ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
		_, err := sess.Exec(sql)
		So(err, ShouldBeNil)

		sql = "INSERT INTO `mysql_types` "
		sql += "(`atinyint`, `avarchar`, `achar`, `amediumint`, `asmallint`, `abigint`, `aint`, `adouble`, "
		sql += "`anewdecimal`, `afloat`, `adatetime`, `atimestamp`, `atime`, `abit`, `atinytext`, "
		sql += "`atinyblob`, `atext`, `ablob`, `amediumtext`, `amediumblob`, `alongtext`, `alongblob`, "
		sql += "`aenum`, `aset`, `adate`) "
		sql += "VALUES(1, 'abc', 'def', 1, 10, 100, 1420070400, 1.11, "
		sql += "2.22, 3.33, now(), current_timestamp(), '11:11:11', 1, 'tinytext', "
		sql += "'tinyblob', 'text', 'blob', 'mediumtext', 'mediumblob', 'longtext', 'longblob', "
		sql += "'val2', 'a,b', curdate());"
		_, err = sess.Exec(sql)
		So(err, ShouldBeNil)

		Convey("TransformToTable should map MySQL column types to Go types", func() {
			rows, err := db.Query("SELECT * FROM mysql_types")
			defer rows.Close()
			So(err, ShouldBeNil)

			queryResult := &tsdb.QueryResult{Meta: simplejson.New()}
			err = executor.TransformToTable(nil, rows, queryResult)
			So(err, ShouldBeNil)
			column := queryResult.Tables[0].Rows[0]
			So(*column[0].(*int8), ShouldEqual, 1)
			So(*column[1].(*string), ShouldEqual, "abc")
			So(*column[2].(*string), ShouldEqual, "def")
			So(*column[3].(*int32), ShouldEqual, 1)
			So(*column[4].(*int16), ShouldEqual, 10)
			So(*column[5].(*int64), ShouldEqual, 100)
			So(*column[6].(*int), ShouldEqual, 1420070400)
			So(*column[7].(*float64), ShouldEqual, 1.11)
			So(*column[8].(*float64), ShouldEqual, 2.22)
			So(*column[9].(*float64), ShouldEqual, 3.33)
			_, offset := time.Now().Zone()
			So((*column[10].(*time.Time)), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
			So(*column[11].(*time.Time), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
			So(*column[12].(*string), ShouldEqual, "11:11:11")
			So(*column[13].(*[]byte), ShouldHaveSameTypeAs, []byte{1})
			So(*column[14].(*string), ShouldEqual, "tinytext")
			So(*column[15].(*string), ShouldEqual, "tinyblob")
			So(*column[16].(*string), ShouldEqual, "text")
			So(*column[17].(*string), ShouldEqual, "blob")
			So(*column[18].(*string), ShouldEqual, "mediumtext")
			So(*column[19].(*string), ShouldEqual, "mediumblob")
			So(*column[20].(*string), ShouldEqual, "longtext")
			So(*column[21].(*string), ShouldEqual, "longblob")
			So(*column[22].(*string), ShouldEqual, "val2")
			So(*column[23].(*string), ShouldEqual, "a,b")
			So(*column[24].(*string), ShouldEqual, time.Now().Format("2006-01-02T00:00:00Z"))
		})
	})
}

func InitMySQLTestDB(t *testing.T) *xorm.Engine {
	x, err := xorm.NewEngine(sqlutil.TestDB_Mysql.DriverName, sqlutil.TestDB_Mysql.ConnStr+"&parseTime=true")

	// x.ShowSQL()

	if err != nil {
		t.Fatalf("Failed to init mysql db %v", err)
	}

	sqlutil.CleanDB(x)

	return x
}
