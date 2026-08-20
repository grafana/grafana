package xorm

import (
	"context"
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/stdlib"
)

const postgresConnectTimeout = 60 * time.Second

var postgresDatabaseDriver driver.Driver = &postgresDriver{}

var _ driver.DriverContext = (*postgresDriver)(nil)
var _ driver.Connector = (*postgresConnector)(nil)

// PostgresDriver returns the pgx database/sql driver configured for Grafana's
// existing SQL argument conventions.
func PostgresDriver() driver.Driver {
	return postgresDatabaseDriver
}

type postgresDriver struct{}

func (d *postgresDriver) Open(name string) (driver.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), postgresConnectTimeout)
	defer cancel()

	connector, err := d.OpenConnector(name)
	if err != nil {
		return nil, err
	}
	return connector.Connect(ctx)
}

func (d *postgresDriver) OpenConnector(name string) (driver.Connector, error) {
	config, err := pgx.ParseConfig(name)
	if err != nil {
		return nil, err
	}

	connector := stdlib.GetConnector(*config, stdlib.OptionAfterConnect(func(_ context.Context, conn *pgx.Conn) error {
		registerPostgresCompatibilityTypes(conn.TypeMap())
		return nil
	}))
	return &postgresConnector{Connector: connector, driver: d}, nil
}

type postgresConnector struct {
	driver.Connector
	driver driver.Driver
}

func (c *postgresConnector) Driver() driver.Driver {
	return c.driver
}

func registerPostgresCompatibilityTypes(typeMap *pgtype.Map) {
	// Existing Grafana and Enterprise SQL code uses 0 and 1 for boolean parameters.
	// The previous PostgreSQL driver converted those values, while pgx requires
	// Go bool values. Preserve that established behavior during the migration.
	typeMap.RegisterType(&pgtype.Type{Name: "bool", OID: pgtype.BoolOID, Codec: integerBoolCodec{}})
}

type integerBoolCodec struct {
	pgtype.BoolCodec
}

func (c integerBoolCodec) PlanEncode(m *pgtype.Map, oid uint32, format int16, value any) pgtype.EncodePlan {
	if isInteger(value) {
		return integerBoolEncodePlan{format: format}
	}
	return c.BoolCodec.PlanEncode(m, oid, format, value)
}

type integerBoolEncodePlan struct {
	format int16
}

func (p integerBoolEncodePlan) Encode(value any, buf []byte) ([]byte, error) {
	boolean, ok := integerBool(value)
	if !ok {
		return nil, fmt.Errorf("cannot encode %T as PostgreSQL boolean", value)
	}

	switch p.format {
	case pgtype.BinaryFormatCode:
		if boolean {
			return append(buf, 1), nil
		}
		return append(buf, 0), nil
	case pgtype.TextFormatCode:
		if boolean {
			return append(buf, 't'), nil
		}
		return append(buf, 'f'), nil
	default:
		return nil, fmt.Errorf("unsupported PostgreSQL boolean format: %d", p.format)
	}
}

func integerBool(value any) (bool, bool) {
	var integer int64
	switch value := value.(type) {
	case int:
		integer = int64(value)
	case int8:
		integer = int64(value)
	case int16:
		integer = int64(value)
	case int32:
		integer = int64(value)
	case int64:
		integer = value
	case uint:
		if uint64(value) > 1 {
			return false, false
		}
		integer = int64(value)
	case uint8:
		integer = int64(value)
	case uint16:
		integer = int64(value)
	case uint32:
		integer = int64(value)
	case uint64:
		if value > 1 {
			return false, false
		}
		integer = int64(value)
	default:
		return false, false
	}

	switch integer {
	case 0:
		return false, true
	case 1:
		return true, true
	default:
		return false, false
	}
}

func isInteger(value any) bool {
	switch value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return true
	default:
		return false
	}
}
