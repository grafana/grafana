/**
 * Renders geopoints as geo-json poly gon entities
 * Allows for them to clip on spheres correctly
 */
function displayGeopoints(scope, dr) {

    var points = [];
    var circle = d3.geo.circle();
    var degrees = 180 / Math.PI

    if (scope.panel.display.geopoints.enabled) {
        //points = dr.points;

      points = _.map(dr.points, function(v) {
        return {
            type: "Point",
            coordinates: [v[0], v[1]]
        };
      });

    }


    dr.geopoints = dr.g.selectAll("path.geopoint")
      .data(points);



    dr.geopoints.enter().append("path")
      /*
        .datum(function(d) {
            return circle.origin([d[0], d[1]]).angle(scope.panel.display.geopoints.pointSize / 6371 * degrees)();
        })
        */
      .attr("class", "geopoint")
      .attr("d", dr.path);

    dr.geopoints.exit().remove();





}