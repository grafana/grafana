package transformations

// Add field from calculation.
#CalculateField: {
	// Transformation ID.
	id: string | *"calculateField"
	// Configuration options.
	options: {
		// The name of your new field. If you leave this blank, then the field will
		// be named to match the calculation.
		alias: string
		// Binary options.
		binary: {
			// Field or number for left side of equation.
			left: string
			// Field or number for right side of equation.
			right: string
			// Operator.
			operator: string | *"+"
			// Calculation to use.
			reducer: string | *"sum"
		}
		// 'reduceRow' - apply selected calculation on each row of selected fields
		// independently.
		// 'binary' - apply basic math operation(sum, multiply, etc) on values in a
		// single row from two selected fields.
		mode: *"reduceRow" | "binary"
		// Reduce options.
		reduce: {
			// Calculation to use.
			reducer: string
			// Fields to include in calculation.
			include: [...string]
		}
		// Hide all other fields and display only your calculated field in the
		// visualization.
		replaceFields: bool | *false
	}
}
