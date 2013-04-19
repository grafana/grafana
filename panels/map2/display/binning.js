/**
 * Hexagonal binning
 * Rendered as normally projected svg paths, which mean they *do not*
 * clip on spheres appropriately.  To fix this, we would need to translate
 * the svg path into a geo-path
 */
function displayBinning(scope, dr, dimensions) {

    var hexbin = d3.hexbin()
        .size(dimensions)
        .radius(scope.panel.display.binning.hexagonSize);


    var binPoints = [],
        binnedPoints = [],
        binRange = 0;


    if (scope.panel.display.binning.enabled) {
        /**
         * primary field is just binning raw counts
         *
         * Secondary field is binning some metric like mean/median/total.  Hexbins doesn't support that,
         * so we cheat a little and just add more points to compensate.
         * However, we don't want to add a million points, so normalize against the largest value
         */
        if (scope.panel.display.binning.areaEncodingField === 'secondary') {
            var max = Math.max.apply(Math, _.map(scope.data, function(k,v){return k;})),
                scale = 50/max;

            _.map(scope.data, function (k, v) {
                var decoded = geohash.decode(v);
                return _.map(_.range(0, k*scale), function(a,b) {
                    binPoints.push(dr.projection([decoded.longitude, decoded.latitude]));
                })
            });

        } else {
            binPoints = dr.projectedPoints;
        }

        //bin and sort the points, so we can set the various ranges appropriately
        binnedPoints = hexbin(binPoints).sort(function(a, b) { return b.length - a.length; });
        binRange = binnedPoints[0].length;

        //clean up some memory
        binPoints = [];
    } else {

        //not enabled, so just set an empty array.  D3.exit will take care of the rest
        binnedPoints = [];
        binRange = 0;
    }



    var radius = d3.scale.sqrt()
        .domain([0, binRange])
        .range([0, scope.panel.display.binning.hexagonSize]);

    var color = d3.scale.linear()
        .domain([0,binRange])
        .range(["white", "steelblue"])
        .interpolate(d3.interpolateLab);


    var hex = dr.g.selectAll(".hexagon")
        .data(binnedPoints);

    hex.enter().append("path")
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

    hex.exit().remove();
}
