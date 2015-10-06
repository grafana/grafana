(function($) {
    "use strict";

    var options = {
        series: {
            fillBelowTo: null
        }
    };

    function init(plot) {
        function findBelowSeries( series, allseries ) {

            var i;

            for ( i = 0; i < allseries.length; ++i ) {
                if ( allseries[ i ].id === series.fillBelowTo ) {
                    return allseries[ i ];
                }
            }

            return null;
        }

        /* top and bottom doesn't actually matter for this, we're just using it to help make this easier to think about */
        /* this is a vector cross product operation */
        function segmentIntersection(top_left_x, top_left_y, top_right_x, top_right_y, bottom_left_x, bottom_left_y, bottom_right_x, bottom_right_y) {
            var top_delta_x, top_delta_y, bottom_delta_x, bottom_delta_y,
                s, t;

            top_delta_x = top_right_x - top_left_x;
            top_delta_y = top_right_y - top_left_y;
            bottom_delta_x = bottom_right_x - bottom_left_x;
            bottom_delta_y = bottom_right_y - bottom_left_y;

            s = (
                (-top_delta_y * (top_left_x - bottom_left_x)) + (top_delta_x * (top_left_y - bottom_left_y))
            ) / (
                -bottom_delta_x * top_delta_y + top_delta_x * bottom_delta_y
            );

            t = (
                (bottom_delta_x * (top_left_y - bottom_left_y)) - (bottom_delta_y * (top_left_x - bottom_left_x))
            ) / (
                -bottom_delta_x * top_delta_y + top_delta_x * bottom_delta_y
            );

            // Collision detected
            if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
                return [
                    top_left_x + (t * top_delta_x), // X
                    top_left_y + (t * top_delta_y) // Y
                ];
            }

            // No collision
            return null;
        }

        function plotDifferenceArea(plot, ctx, series) {
            if ( series.fillBelowTo === null ) {
                return;
            }

            var otherseries,

                ps,
                points,

                otherps,
                otherpoints,

                plotOffset,
                fillStyle;

            function openPolygon(x, y) {
                ctx.beginPath();
                ctx.moveTo(
                    series.xaxis.p2c(x) + plotOffset.left,
                    series.yaxis.p2c(y) + plotOffset.top
                );

            }

            function closePolygon() {
                ctx.closePath();
                ctx.fill();
            }

            function validateInput() {
                if (points.length/ps !== otherpoints.length/otherps) {
                    console.error("Refusing to graph inconsistent number of points");
                    return false;
                }

                var i;
                for (i = 0; i < (points.length / ps); i++) {
                    if (
                        points[i * ps] !== null &&
                        otherpoints[i * otherps] !== null &&
                        points[i * ps] !== otherpoints[i * otherps]
                    ) {
                        console.error("Refusing to graph points without matching value");
                        return false;
                    }
                }

                return true;
            }

            function findNextStart(start_i, end_i) {
                console.assert(end_i > start_i, "expects the end index to be greater than the start index");

                var start = (
                        start_i === 0 ||
                        points[start_i - 1] === null ||
                        otherpoints[start_i - 1] === null
                    ),
                    equal = false,
                    i,
                    intersect;

                for (i = start_i; i < end_i; i++) {
                    // Take note of null points
                    if (
                        points[(i * ps) + 1] === null ||
                        otherpoints[(i * ps) + 1] === null
                    ) {
                        equal = false;
                        start = true;
                    }

                    // Take note of equal points
                    else if (points[(i * ps) + 1] === otherpoints[(i * otherps) + 1]) {
                        equal = true;
                        start = false;
                    }


                    else if (points[(i * ps) + 1] > otherpoints[(i * otherps) + 1]) {
                        // If we begin above the desired point
                        if (start) {
                            openPolygon(points[i * ps], points[(i * ps) + 1]);
                        }

                        // If an equal point preceeds this, start the polygon at that equal point
                        else if (equal) {
                            openPolygon(points[(i - 1) * ps], points[((i - 1) * ps) + 1]);
                        }

                        // Otherwise, find the intersection point, and start it there
                        else {
                            intersect = intersectionPoint(i);
                            openPolygon(intersect[0], intersect[1]);
                        }

                        topTraversal(i, end_i);
                        return;
                    }

                    // If we go below equal, equal at any preceeding point is irrelevant
                    else {
                        start = false;
                        equal = false;
                    }
                }
            }

            function intersectionPoint(right_i) {
                console.assert(right_i > 0, "expects the second point in the series line segment");

                var i, intersect;

                for (i = 1; i < (otherpoints.length/otherps); i++) {
                    intersect = segmentIntersection(
                        points[(right_i - 1) * ps], points[((right_i - 1) * ps) + 1],
                        points[right_i * ps], points[(right_i * ps) + 1],

                        otherpoints[(i - 1) * otherps], otherpoints[((i - 1) * otherps) + 1],
                        otherpoints[i * otherps], otherpoints[(i * otherps) + 1]
                    );

                    if (intersect !== null) {
                        return intersect;
                    }
                }

                console.error("intersectionPoint() should only be called when an intersection happens");
            }

            function bottomTraversal(start_i, end_i) {
                console.assert(start_i >= end_i, "the start should be the rightmost point, and the end should be the leftmost (excluding the equal or intersecting point)");

                var i;

                for (i = start_i; i >= end_i; i--) {
                    ctx.lineTo(
                        otherseries.xaxis.p2c(otherpoints[i * otherps]) + plotOffset.left,
                        otherseries.yaxis.p2c(otherpoints[(i * otherps) + 1]) + plotOffset.top
                    );
                }

                closePolygon();
            }

            function topTraversal(start_i, end_i) {
                console.assert(start_i <= end_i, "the start should be the rightmost point, and the end should be the leftmost (excluding the equal or intersecting point)");

                var i,
                    intersect;

                for (i = start_i; i < end_i; i++) {
                    if (points[(i * ps) + 1] === null && i > start_i) {
                        bottomTraversal(i - 1, start_i);
                        findNextStart(i, end_i);
                        return;
                    }

                    else if (points[(i * ps) + 1] === otherpoints[(i * otherps) + 1]) {
                        bottomTraversal(i, start_i);
                        findNextStart(i, end_i);
                        return;
                    }

                    else if (points[(i * ps) + 1] < otherpoints[(i * otherps) + 1]) {
                        intersect = intersectionPoint(i);
                        ctx.lineTo(
                            series.xaxis.p2c(intersect[0]) + plotOffset.left,
                            series.yaxis.p2c(intersect[1]) + plotOffset.top
                        );
                        bottomTraversal(i, start_i);
                        findNextStart(i, end_i);
                        return;

                    }

                    else {
                        ctx.lineTo(
                            series.xaxis.p2c(points[i * ps]) + plotOffset.left,
                            series.yaxis.p2c(points[(i * ps) + 1]) + plotOffset.top
                        );
                    }
                }

                bottomTraversal(end_i, start_i);
            }


            // Begin processing

            otherseries = findBelowSeries( series, plot.getData() );

            if ( !otherseries ) {
                return;
            }

            ps = series.datapoints.pointsize;
            points = series.datapoints.points;
            otherps = otherseries.datapoints.pointsize;
            otherpoints = otherseries.datapoints.points;
            plotOffset = plot.getPlotOffset();

            if (!validateInput()) {
                return;
            }


            // Flot's getFillStyle() should probably be exposed somewhere
            fillStyle = $.color.parse(series.color);
            fillStyle.a = 0.4;
            fillStyle.normalize();
            ctx.fillStyle = fillStyle.toString();


            // Begin recursive bi-directional traversal
            findNextStart(0, points.length/ps);
        }

        plot.hooks.drawSeries.push(plotDifferenceArea);
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: "fillbelow",
        version: "0.1.0"
    });

})(jQuery);
