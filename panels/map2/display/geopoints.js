function displayGeopoints(scope, path) {

    /*
    scope.g.selectAll("circles.points")
        .data(points)
        .enter()
        .append("circle")
        .attr("r", scope.panel.display.geopoints.pointSize)
        .attr("opacity", scope.panel.display.geopoints.pointAlpha)
        .attr("transform", function (d) {
            return "translate(" + d[0] + "," + d[1] + ")";
        });

    */



    var points = []
    if (scope.panel.display.bullseye.enabled) {
        points = scope.points;
    }

    var circle = d3.geo.circle();
    var degrees = 180 / Math.PI

    var geopoints = scope.g.selectAll("geopoints")
        .data(points);

    geopoints.enter().append("path")
        .datum(function(d) {
            return circle.origin([d[0], d[1]]).angle(scope.panel.display.geopoints.pointSize / 6371 * degrees)();
        })
        .attr("d", path)
        .attr("class", "geopoint");

    geopoints.exit().remove();





}