/**
 * Renders bullseyes as geo-json poly gon entities
 * Allows for them to clip on spheres correctly
 */
function displayBullseye(scope, dr) {

    var degrees = 180 / Math.PI
    var circle = d3.geo.circle();
    var data = [];

    if (scope.panel.display.bullseye.enabled) {
        data =  [
          circle.origin(parseFloat(scope.panel.display.bullseye.coord.lat), parseFloat(scope.panel.display.bullseye.coord.lon)).angle(1000 / 6371 * degrees)()
        ];
    }

    var arcs = dr.g.selectAll(".arc")
        .data(data);

    arcs.enter().append("path")

        .attr("d", dr.path)
        .attr("class", "arc");

    arcs.exit().remove();


}