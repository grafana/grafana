package migrator

import (
	"embed"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed golang-migrate/*/*.sql
var fs embed.FS

func GetMigrateSourceDriver(driverName string) (source.Driver, error) {
	d, err := iofs.New(fs, filepath.Join("golang-migrate", driverName))
	if err != nil {
		return nil, err
	}

	return d, nil
}
