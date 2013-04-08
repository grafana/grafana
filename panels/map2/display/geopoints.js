function displayGeopoints() {
    g.selectAll("circles.points")
        .data(points)
        .enter()
        .append("circle")
        .attr("r", scope.panel.display.geopoints.pointSize)
        .attr("opacity", scope.panel.display.geopoints.pointAlpha)
        .attr("transform", function (d) {
            return "translate(" + d[0] + "," + d[1] + ")";
        });
}