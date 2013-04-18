/**
 * Renders bullseyes as geo-json poly gon entities
 * Allows for them to clip on spheres correctly
 */
function displayBullseye(scope, dr, path) {

    var degrees = 180 / Math.PI
    var circle = d3.geo.circle();
    var data = [];

    if (scope.panel.display.bullseye.enabled) {
        data =  [
            {lat: parseFloat(scope.panel.display.bullseye.coord.lat), lon: parseFloat(scope.panel.display.bullseye.coord.lon)}
        ];
    }

    var arcs = dr.g.selectAll(".arc")
        .data(data);

    arcs.enter().append("path")
        .datum(function(d) {
            return circle.origin([d.lon, d.lat]).angle(1000 / 6371 * degrees)();
        })
        .attr("d", path)
        .attr("class", "arc");

    arcs.exit().remove();


}