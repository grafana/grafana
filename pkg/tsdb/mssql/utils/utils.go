package utils

import (
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	mssql "github.com/microsoft/go-mssqldb"
)

// GetJsonData just gets the json in easier to work with type. It's used on multiple places which isn't super effective
// but only when creating a client which should not happen often anyway.
func getJsonData(settings backend.DataSourceInstanceSettings) (map[string]interface{}, error) {
	var jsonData map[string]interface{}
	err := json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling JSONData: %w", err)
	}
	return jsonData, nil
}

func GetAzureCredentials(settings backend.DataSourceInstanceSettings) (azcredentials.AzureCredentials, error) {
	jsonData, err := getJsonData(settings)
	if err != nil {
		return nil, err
	}
	return azcredentials.FromDatasourceData(jsonData, settings.DecryptedSecureJSONData)
}

type DebugOnlyLogger interface {
	Debug(msg string, args ...interface{})
}

// ParseURL tries to parse an MSSQL URL string into a URL object.
func ParseURL(u string, logger DebugOnlyLogger) (*url.URL, error) {
	logger.Debug("Parsing MSSQL URL", "url", u)

	// Recognize ODBC connection strings like host\instance:1234
	reODBC := regexp.MustCompile(`^[^\\:]+(?:\\[^:]+)?(?::\d+)?(?:;.+)?$`)
	var host string
	switch {
	case reODBC.MatchString(u):
		logger.Debug("Recognized as ODBC URL format", "url", u)
		host = u
	default:
		logger.Debug("Couldn't recognize as valid MSSQL URL", "url", u)
		return nil, fmt.Errorf("unrecognized MSSQL URL format: %q", u)
	}
	return &url.URL{
		Scheme: "sqlserver",
		Host:   host,
	}, nil
}

type MSSQLQueryResultTransformer struct {
	UserError string
}

func (t *MSSQLQueryResultTransformer) TransformQueryError(logger log.Logger, err error) error {
	// go-mssql overrides source error, so we currently match on string
	// ref https://github.com/denisenkom/go-mssqldb/blob/045585d74f9069afe2e115b6235eb043c8047043/tds.go#L904
	if strings.HasPrefix(strings.ToLower(err.Error()), "unable to open tcp connection with host") {
		logger.Error("Query error", "error", err)
		return fmt.Errorf("failed to connect to server - %s", t.UserError)
	}

	return err
}

func (t *MSSQLQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle MONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "MONEY",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle SMALLMONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "SMALLMONEY",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle DECIMAL",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "DECIMAL",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle UNIQUEIDENTIFIER",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "UNIQUEIDENTIFIER",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableString,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					uuid := &mssql.UniqueIdentifier{}
					if err := uuid.Scan([]byte(*in)); err != nil {
						return nil, err
					}
					v := uuid.String()
					return &v, nil
				},
			},
		},
		{
			Name:           "handle SQL_VARIANT",
			InputScanKind:  reflect.Pointer,
			InputTypeName:  "SQL_VARIANT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableString,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					return in, nil
				},
			},
		},
	}
}
