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

		endpoint := &MysqlQueryEndpoint{
			sqlEngine: &tsdb.DefaultSqlEngine{
				MacroEngine: NewMysqlMacroEngine(),
				XormEngine:  x,
			},
			log: log.New("tsdb.mysql"),
		}

		sess := x.NewSession()
		defer sess.Close()

		sql := "CREATE TABLE `mysql_types` ("
		sql += "`atinyint` tinyint(1) NOT NULL,"
		sql += "`avarchar` varchar(3) NOT NULL,"
		sql += "`achar` char(3),"
		sql += "`amediumint` mediumint NOT NULL,"
		sql += "`asmallint` smallint NOT NULL,"
		sql += "`abigint` bigint NOT NULL,"
		sql += "`aint` int(11) NOT NULL,"
		sql += "`adouble` double(10,2),"
		sql += "`anewdecimal` decimal(10,2),"
		sql += "`afloat` float(10,2) NOT NULL,"
		sql += "`atimestamp` timestamp NOT NULL,"
		sql += "`adatetime` datetime NOT NULL,"
		sql += "`atime` time NOT NULL,"
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
		sql += "`adate` date,"
		sql += "`time_sec` datetime(6),"
		sql += "`aintnull` int(11),"
		sql += "`afloatnull` float(10,2),"
		sql += "`avarcharnull` varchar(3),"
		sql += "`adecimalnull` decimal(10,2)"
		sql += ") ENGINE=InnoDB DEFAULT CHARSET=latin1;"
		_, err := sess.Exec(sql)
		So(err, ShouldBeNil)

		sql = "INSERT INTO `mysql_types` "
		sql += "(`atinyint`, `avarchar`, `achar`, `amediumint`, `asmallint`, `abigint`, `aint`, `adouble`, "
		sql += "`anewdecimal`, `afloat`, `adatetime`, `atimestamp`, `atime`, `abit`, `atinytext`, "
		sql += "`atinyblob`, `atext`, `ablob`, `amediumtext`, `amediumblob`, `alongtext`, `alongblob`, "
		sql += "`aenum`, `aset`, `adate`, `time_sec`) "
		sql += "VALUES(1, 'abc', 'def', 1, 10, 100, 1420070400, 1.11, "
		sql += "2.22, 3.33, now(), current_timestamp(), '11:11:11', 1, 'tinytext', "
		sql += "'tinyblob', 'text', 'blob', 'mediumtext', 'mediumblob', 'longtext', 'longblob', "
		sql += "'val2', 'a,b', curdate(), '2018-01-01 00:01:01.123456');"
		_, err = sess.Exec(sql)
		So(err, ShouldBeNil)

		Convey("Query with Table format should map MySQL column types to Go types", func() {
			query := &tsdb.TsdbQuery{
				Queries: []*tsdb.Query{
					{
						Model: simplejson.NewFromAny(map[string]interface{}{
							"rawSql": "SELECT * FROM mysql_types",
							"format": "table",
						}),
						RefId: "A",
					},
				},
			}

			resp, err := endpoint.Query(nil, nil, query)
			queryResult := resp.Results["A"]
			So(err, ShouldBeNil)

			column := queryResult.Tables[0].Rows[0]

			So(*column[0].(*int8), ShouldEqual, 1)
			So(column[1].(string), ShouldEqual, "abc")
			So(column[2].(string), ShouldEqual, "def")
			So(*column[3].(*int32), ShouldEqual, 1)
			So(*column[4].(*int16), ShouldEqual, 10)
			So(*column[5].(*int64), ShouldEqual, 100)
			So(*column[6].(*int32), ShouldEqual, 1420070400)
			So(column[7].(float64), ShouldEqual, 1.11)
			So(column[8].(float64), ShouldEqual, 2.22)
			So(*column[9].(*float32), ShouldEqual, 3.33)
			_, offset := time.Now().Zone()
			So(column[10].(time.Time), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
			So(column[11].(time.Time), ShouldHappenWithin, time.Duration(10*time.Second), time.Now().Add(time.Duration(offset)*time.Second))
			So(column[12].(string), ShouldEqual, "11:11:11")
			So(*column[13].(*[]byte), ShouldHaveSameTypeAs, []byte{1})
			So(column[14].(string), ShouldEqual, "tinytext")
			So(column[15].(string), ShouldEqual, "tinyblob")
			So(column[16].(string), ShouldEqual, "text")
			So(column[17].(string), ShouldEqual, "blob")
			So(column[18].(string), ShouldEqual, "mediumtext")
			So(column[19].(string), ShouldEqual, "mediumblob")
			So(column[20].(string), ShouldEqual, "longtext")
			So(column[21].(string), ShouldEqual, "longblob")
			So(column[22].(string), ShouldEqual, "val2")
			So(column[23].(string), ShouldEqual, "a,b")
			So(column[24].(time.Time).Format("2006-01-02T00:00:00Z"), ShouldEqual, time.Now().Format("2006-01-02T00:00:00Z"))
			So(column[25].(float64), ShouldEqual, 1514764861)
			So(column[26], ShouldEqual, nil)
			So(column[27], ShouldEqual, nil)
			So(column[28], ShouldEqual, "")
			So(column[29], ShouldEqual, nil)
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
