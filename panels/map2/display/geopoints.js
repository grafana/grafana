function displayGeopoints(scope, path) {

    /*
     var points = {};
     var circle = d3.geo.circle();
     var degrees = 180 / Math.PI;

     if (scope.panel.display.geopoints.enabled) {
     //points = scope.points;

     var features = _.map(scope.points, function(coords) {
     return {
     feature: circle.origin(scope.projection([coords[0], coords[1]]))
     .angle(scope.panel.display.geopoints.pointSize / 6371 * degrees)()
     };
     });

     console.log("features", features);
     points = {
     type: "FeatureCollection",
     features: features
     };
     console.log("points", points);

     }

     console.log("points2", points);
     scope.svg.append("path")
     .datum(points)
     .attr("d", d3.geo.path());


     */



    var points = []
    if (scope.panel.display.geopoints.enabled) {
        points = scope.points;
    }

    var circle = d3.geo.circle();
    var degrees = 180 / Math.PI

    var geopoints = scope.g.selectAll(".geopoint")
        .data(points);

    geopoints.enter().append("path")
        .datum(function(d) {
            return circle.origin([d[0], d[1]]).angle(scope.panel.display.geopoints.pointSize / 6371 * degrees)();
        })
        .attr("d", path)
        .attr("class", "geopoint");

    geopoints.exit().remove();





}