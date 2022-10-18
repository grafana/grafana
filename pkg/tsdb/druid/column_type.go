package druid

import (
	"strconv"
	"strings"
	"time"
)

func detectColumnType(c *responseColumn, pos int, rows [][]interface{}) {
	t := map[columnType]int{"nil": 0}
	maxRowsToScan := (len(rows) / 5) + 1
	for _, row := range rows[:maxRowsToScan] {
		switch v := row[pos].(type) {
		case string:
			_, err := strconv.Atoi(v)
			if err == nil {
				t[ColumnInt]++
				continue
			}
			_, err = strconv.ParseBool(v)
			if err == nil {
				t[ColumnBool]++
				continue
			}
			// TODO is there any other timestamp format possible?
			_, err = time.Parse("2006-01-02T15:04:05.000Z", v)
			if err == nil {
				t[ColumnTime]++
				continue
			}
			t[ColumnString]++
			continue
		case float64:
			if c.Name == "__time" || strings.Contains(strings.ToLower(c.Name), "time_") {
				t[ColumnTime]++
				continue
			}
			t[ColumnFloat]++
			continue
		case bool:
			t[ColumnBool]++
			continue
		}
	}
	key := ColumnString
	maxVal := 0
	for k, v := range t {
		if v > maxVal {
			maxVal = v
			key = k
		}
	}
	c.Type = key
}
