package assets

import "embed"

// EmbedMigrations within the grafana binary.
//
//go:embed migrations/*
var EmbedMigrations embed.FS

const SQLiteMigrationDir = "migrations/sqlite"
