
function displayBinning(scope, dimensions, projection, path) {

    /**
     * Hexbin-specific setup
     */
    var hexbin = d3.hexbin()
        .size(dimensions)
        .radius(scope.panel.display.binning.hexagonSize);


    var binPoints = [];

    //primary field is just binning raw counts
    //secondary field is binning some metric like mean/median/total.  Hexbins doesn't support that,
    //so we cheat a little and just add more points to compensate.
    //However, we don't want to add a million points, so normalize against the largest value
    if (scope.panel.display.binning.areaEncodingField === 'secondary') {
        var max = Math.max.apply(Math, _.map(scope.data, function(k,v){return k;})),
            scale = 50/max;

        _.map(scope.data, function (k, v) {
            var decoded = geohash.decode(v);
            return _.map(_.range(0, k*scale), function(a,b) {
                binPoints.push(projection([decoded.longitude, decoded.latitude]));
            })
        });

    } else {

        binPoints = scope.projectedPoints;
    }

    //bin and sort the points, so we can set the various ranges appropriately
    var binnedPoints = hexbin(binPoints).sort(function(a, b) { return b.length - a.length; });;

    //clean up some memory
    binPoints = [];

    var radius = d3.scale.sqrt()
        .domain([0, binnedPoints[0].length])
        .range([0, scope.panel.display.binning.hexagonSize]);

    var color = d3.scale.linear()
        .domain([0,binnedPoints[0].length])
        .range(["white", "steelblue"])
        .interpolate(d3.interpolateLab);


    /**
     * D3 Drawing
     */


    scope.g.selectAll("hexagon")
        .data(binnedPoints)
        .enter().append("path")
        .attr("d", function (d) {
            if (scope.panel.display.binning.areaEncoding === false) {
                return hexbin.hexagon();
            } else {
                return hexbin.hexagon(radius(d.length));
            }
        })
        .attr("class", "hexagon")
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        .style("fill", function (d) {
            if (scope.panel.display.binning.colorEncoding === false) {
                return color(binnedPoints[0].length / 2);
            } else {
                return color(d.length);
            }
        })
        .attr("opacity", scope.panel.display.binning.hexagonAlpha);
}