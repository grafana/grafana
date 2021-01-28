package panels

#Graph: _panel & {
	// Display values as a bar chart.
	bars: bool | *false
	// Dashed line length.
	dashLength: int | *10
	// Show line with dashes.
	dashes: bool | *false
	// Dashed line spacing when `dashes` is true.
	spaceLength: int | *10
	// Controls how many decimals are displayed for legend values and graph hover
	// tooltips.
	decimals: int
	// Field config.
	fieldConfig: {
		// Defaults.
		defaults: custom: {}
		// Overrides.
		overrides: [..._override]
	}
	// Amount of color fill for a series. Expects a value between 0 and 1.
	fill: number >= 0 <= 1 | *1
	// Degree of gradient on the area fill. 0 is no gradient, 10 is a steep
	// gradient.
	fillGradient: int >= 0 <= 10 | *0
	// Hide the series.
	hiddenSeries: bool | *false
	// Lengend options.
	legend: {
		// Whether to display legend in table.
		alignAsTable: bool | *false
		// Average of all values returned from the metric query.
		avg: bool | *false
		// Last value returned from the metric query.
		current: bool | *false
		// Maximum of all values returned from the metric query.
		max: bool | *false
		// Minimum of all values returned from the metric query.
		min: bool | *false
		// Display legend to the right.
		rightSide: bool | *false
		// Show or hide the legend.
		show: bool | *true
		// Available when `rightSide` is true. The minimum width for the legend in
		// pixels.
		sideWidth?: int
		// Sum of all values returned from the metric query.
		total: bool | *false
		// Values.
		values: bool | *true
	}
	// Display values as a line graph.
	lines: bool | *true
	// The width of the line for a series.
	linewidth: int | *1
	// How null values are displayed.
	// * 'null' - If there is a gap in the series, meaning a null value, then the
	// line in the graph will be broken and show the gap.
	// * 'null as zero' - If there is a gap in the series, meaning a null value,
	// then it will be displayed as a zero value in the graph panel.
	// * 'connected' - If there is a gap in the series, meaning a null value or
	// values, then the line will skip the gap and connect to the next non-null
	// value.
	nullPointMode: string | *"null"
	// Options.
	options: {
		// Data links.
		dataLinks: [..._dataLink]
	}
	// Available when `stack` is true. Each series is drawn as a percentage of the
	// total of all series.
	percentage: bool | *false
	// Controls how large the points are.
	pointradius: int
	// Display points for values.
	points: bool | *true
	// Renderer.
	renderer: string | *"flot"
	// Series overrides allow a series in a graph panel to be rendered
	// differently from the others. You can customize display options on a
	// per-series bases or by using regex rules. For example, one series can have
	// a thicker line width to make it stand out or be moved to the right Y-axis.
	seriesOverrides: [...{
		// Alias or regex matching the series you'd like to target.
		alias?:         string
		bars?:          bool
		lines?:         bool
		fill?:          int
		fillGradient?:  int
		linewidth?:     int
		nullPointMode?: string
		fillBelowTo?:   string
		steppedLine?:   bool
		dashes?:        bool
		hiddenSeries?:  bool
		dashLength?:    int
		spaceLength?:   int
		points?:        bool
		pointradius?:   int
		stack?:         int
		color?:         string
		yaxis?:         int
		zindex?:        int
		transform?:     string
		legend?:        bool
		hideTooltip?:   bool
	}]
	// Each series is stacked on top of another.
	stack: bool | *false
	// Draws adjacent points as staircase.
	steppedLine: bool | *false
	// Threshold config.
	thresholds: _thresholds
	// Time from.
	timeFrom: string
	// Time regions.
	timeRegions: [...string]
	// Time shift
	timeShift: string
	// Tooltip settings.
	tooltip: {
		// * true - The hover tooltip shows all series in the graph.  Grafana
		// highlights the series that you are hovering over in bold in the series
		// list in the tooltip.
		// * false - The hover tooltip shows only a single series, the one that you
		// are hovering over on the graph.
		shared: bool | *true
		// * 0 (none) - The order of the series in the tooltip is determined by the
		// sort order in your query. For example, they could be alphabetically
		// sorted by series name.
		// * 1 (increasing) - The series in the hover tooltip are sorted by value
		// and in increasing order, with the lowest value at the top of the list.
		// * 2 (decreasing) - The series in the hover tooltip are sorted by value
		// and in decreasing order, with the highest value at the top of the list.
		sort: int >= 0 <= 2 | *2
		// Value type.
		value_type: string | *"individual"
	}
	// Panel type.
	type: string | *"graph"
	xaxis: {
		// Buckets.
		buckets: string
		// The display mode completely changes the visualization of the graph
		// panel. It’s like three panels in one. The main mode is the time series
		// mode with time on the X-axis. The other two modes are a basic bar chart
		// mode with series on the X-axis instead of time and a histogram mode.
		// * 'time' - The X-axis represents time and that the data is grouped by
		// time (for example, by hour, or by minute).
		// * 'series' - The data is grouped by series and not by time. The Y-axis
		// still represents the value.
		// * 'histogram' - Converts the graph into a histogram. A histogram is a
		// kind of bar chart that groups numbers into ranges, often called buckets
		// or bins. Taller bars show that more data falls in that range.
		mode: string | *"time"
		// Name.
		name: string
		// Show or hide the axis.
		show: bool | *true
		// Values
		values: [...number]
	}
	yaxes: [...{
		// Defines how many decimals are displayed for Y value.
		decimals: int
		// The display unit for the Y value.
		format: string | *"short"
		// The Y axis label.
		label: string
		// The scale to use for the Y value - linear, or logarithmic.
		// * 1 - linear
		// * 2 - log (base 2)
		// * 10 - log (base 10)
		// * 32 - log (base 32)
		// * 1024 - log (base 1024)
		logBase: int | *1
		// The maximum Y value.
		max?: int
		// The minimum Y value.
		min?: int
		// Show or hide the axis.
		show: bool | *true
	}]
	yaxis: {
		// Align left and right Y-axes by value.
		align: bool | *false
		// Available when align is true. Value to use for alignment of left and
		// right Y-axes, starting from Y=0.
		alignLevel: int | *0
	}
}
