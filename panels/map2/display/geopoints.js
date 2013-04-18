/**
 * Renders geopoints as geo-json poly gon entities
 * Allows for them to clip on spheres correctly
 */
function displayGeopoints(scope, dr, path) {

    var points = [];
    var circle = d3.geo.circle();
    var degrees = 180 / Math.PI

    if (scope.panel.display.geopoints.enabled) {
        points = dr.points;
    }



    var geopoints = dr.g.selectAll(".geopoint")
        .data(points);

    geopoints.enter().append("path")
        .datum(function(d) {
            return circle.origin([d[0], d[1]]).angle(scope.panel.display.geopoints.pointSize / 6371 * degrees)();
        })
        .attr("d", path)
        .attr("class", "geopoint");

    geopoints.exit().remove();





}