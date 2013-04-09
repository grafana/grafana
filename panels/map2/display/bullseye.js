function displayBullseye(scope, projection, path) {

    var arc = d3.svg.arc()
        .innerRadius(5)
        .outerRadius(10)
        .startAngle(0) //converting from degs to radians
        .endAngle(2*Math.PI) //just radians

    var coords = projection([parseFloat(scope.panel.display.bullseye.coord.lon), parseFloat(scope.panel.display.bullseye.coord.lat)]);


    var circle = d3.geo.circle();

    var data = [
        {lat: parseFloat(scope.panel.display.bullseye.coord.lat), lon: parseFloat(scope.panel.display.bullseye.coord.lon)}
    ];

    scope.g.selectAll("arc")
        .data(data)
        .enter().append("path")
        .datum(function(d) {
            console.log(d);

            return circle.origin([d.lon, d.lat]).angle(1)();
        })
        .attr("d", path)
        .attr("class", "arc");


    /*
    scope.g.append("path")
        .attr("d", arc)
        .attr("transform", "translate(" + coords[0] + "," + coords[1] + ")");

    scope.g
        .append("circle")
        .attr("r", 1)
        .attr("opacity", 1)
        .attr("transform", "translate(" + coords[0] + "," + coords[1] + ")");
*/

}