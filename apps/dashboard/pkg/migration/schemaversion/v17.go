package schemaversion

import (
	"math"
	"sort"
)

// V17 migrates panel minSpan property to maxPerRow property.
// This migration converts the deprecated minSpan property to the newer maxPerRow property
// which controls how many panels can be displayed in a single row.
//
// The conversion algorithm:
// 1. Calculate max = GRID_COLUMN_COUNT / panel.minSpan
// 2. Get all factors of GRID_COLUMN_COUNT (24): [1, 2, 3, 4, 6, 8, 12, 24]
// 3. Find the first factor greater than max
// 4. Use the previous factor as maxPerRow
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "graph",
//	    "minSpan": 8
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "graph",
//	    "maxPerRow": 3
//	  }
//	]
//
// The minSpan property is removed after conversion.
func V17(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 17

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		migrateMinSpanToMaxPerRow(panel)
	}

	return nil
}

// migrateMinSpanToMaxPerRow converts minSpan to maxPerRow using the same algorithm as the frontend.
func migrateMinSpanToMaxPerRow(panel map[string]interface{}) {
	minSpanValue, ok := panel["minSpan"]
	if !ok {
		return
	}

	// Convert minSpan to a number using shared utility
	minSpan, ok := ConvertToFloat(minSpanValue)
	if !ok {
		// If we can't convert minSpan to a number, just delete it and return
		delete(panel, "minSpan")
		return
	}

	// Ensure minSpan is positive to avoid division by zero
	if minSpan <= 0 {
		delete(panel, "minSpan")
		return
	}

	const gridColumnCount = 24
	max := gridColumnCount / minSpan
	factors := getFactors(gridColumnCount)

	// Find the first factor greater than max
	factorIndex := -1
	for i, factor := range factors {
		if float64(factor) > max {
			factorIndex = i
			break
		}
	}

	// Use the previous factor as maxPerRow
	if factorIndex > 0 {
		panel["maxPerRow"] = factors[factorIndex-1]
	} else if factorIndex == 0 {
		// If the first factor is already greater than max, use 1
		panel["maxPerRow"] = 1
	} else {
		// If no factor is greater than max, use the largest factor
		panel["maxPerRow"] = factors[len(factors)-1]
	}

	// Remove the minSpan property
	delete(panel, "minSpan")
}

// getFactors returns all factors of a number
// Example: getFactors(24) returns [1, 2, 3, 4, 6, 8, 12, 24]
func getFactors(num int) []int {
	factors := []int{}
	for i := 1; i <= int(math.Sqrt(float64(num))); i++ {
		if num%i == 0 {
			factors = append(factors, i)
			if i != num/i {
				factors = append(factors, num/i)
			}
		}
	}

	// Sort factors in ascending order
	sort.Ints(factors)

	return factors
}
