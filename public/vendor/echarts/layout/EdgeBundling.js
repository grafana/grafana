/**
 * Edge bundling laytout
 *
 * Use MINGLE algorithm
 * Multilevel agglomerative edge bundling for visualizing large graphs
 *
 * @module echarts/layout/EdgeBundling
 */
define(function (require) {

    var KDTree = require('../data/KDTree');
    var vec2 = require('zrender/tool/vector');
    var v2Create = vec2.create;
    var v2DistSquare = vec2.distSquare;
    var v2Dist = vec2.dist;
    var v2Copy = vec2.copy;
    var v2Clone = vec2.clone;

    function squaredDistance(a, b) {
        a = a.array;
        b = b.array;

        var x = b[0] - a[0];
        var y = b[1] - a[1];
        var z = b[2] - a[2];
        var w = b[3] - a[3];

        return x * x + y * y + z * z + w * w;
    }

    function CoarsenedEdge(group) {
        this.points = [
            group.mp0, group.mp1
        ];

        this.group = group;
    }

    function Edge(edge) {
        var points = edge.points;
        // Sort on y
        if (
            points[0][1] < points[1][1]
            // If coarsened edge is flipped, the final composition of meet point
            // will be unordered
            || edge instanceof CoarsenedEdge
        ) {
            this.array = [points[0][0], points[0][1], points[1][0], points[1][1]];
            this._startPoint = points[0];
            this._endPoint = points[1];
        }
        else {
            this.array = [points[1][0], points[1][1], points[0][0], points[0][1]];
            this._startPoint = points[1];
            this._endPoint = points[0];
        }

        this.ink = v2Dist(points[0], points[1]);

        this.edge = edge;

        this.group = null;
    }

    Edge.prototype.getStartPoint = function () {
        return this._startPoint;
    };

    Edge.prototype.getEndPoint = function () {
        return this._endPoint;
    };

    function BundledEdgeGroup() {

        this.edgeList = [];

        this.mp0 = v2Create();
        this.mp1 = v2Create();

        this.ink = 0;
    }

    BundledEdgeGroup.prototype.addEdge = function (edge) {
        edge.group = this;
        this.edgeList.push(edge);
    };

    BundledEdgeGroup.prototype.removeEdge = function (edge) {
        edge.group = null;
        this.edgeList.splice(this.edgeList.indexOf(edge), 1);
    };

    /**
     * @constructor
     * @alias module:echarts/layout/EdgeBundling
     */
    function EdgeBundling() {
        this.maxNearestEdge = 6;
        this.maxTurningAngle = Math.PI / 4;
        this.maxIteration = 20;
    }

    EdgeBundling.prototype = {
        
        constructor: EdgeBundling,

        run: function (rawEdges) {
            var res = this._iterate(rawEdges);
            var nIterate = 0;
            while (nIterate++ < this.maxIteration) {
                var coarsenedEdges = [];
                for (var i = 0; i < res.groups.length; i++) {
                    coarsenedEdges.push(new CoarsenedEdge(res.groups[i]));
                }
                var newRes = this._iterate(coarsenedEdges);
                if (newRes.savedInk <= 0) {
                    break;
                } else {
                    res = newRes;
                }
            }

            // Get new edges
            var newEdges = [];

            function pointApproxEqual(p0, p1) {
                // Use Float32Array may affect the precision
                return v2DistSquare(p0, p1) < 1e-10;
            }
            // Clone all points to make sure all points in edge will not reference to the same array
            // And clean the duplicate points
            function cleanEdgePoints(edgePoints, rawEdgePoints) {
                var res = [];
                var off = 0;
                for (var i = 0; i < edgePoints.length; i++) {
                    if (! (off > 0 && pointApproxEqual(edgePoints[i], res[off - 1]))) {
                        res[off++] = v2Clone(edgePoints[i]);
                    }
                }
                // Edge has been reversed
                if (rawEdgePoints[0] && !pointApproxEqual(res[0], rawEdgePoints[0])) {
                    res = res.reverse();
                }
                return res;
            }

            var buildNewEdges = function (groups, fromEdgePoints) {
                var newEdgePoints;
                for (var i = 0; i < groups.length; i++) {
                    var group = groups[i];
                    if (
                        group.edgeList[0]
                        && (group.edgeList[0].edge instanceof CoarsenedEdge)
                    ) {
                        var newGroups = [];
                        for (var j = 0; j < group.edgeList.length; j++) {
                            newGroups.push(group.edgeList[j].edge.group);
                        }
                        if (! fromEdgePoints) {
                            newEdgePoints = [];
                        } else {
                            newEdgePoints = fromEdgePoints.slice();
                        }
                        newEdgePoints.unshift(group.mp0);
                        newEdgePoints.push(group.mp1);
                        buildNewEdges(newGroups, newEdgePoints);
                    } else {
                        // console.log(group.edgeList.length);
                        for (var j = 0; j < group.edgeList.length; j++) {
                            var edge = group.edgeList[j];
                            if (! fromEdgePoints) {
                                newEdgePoints = [];
                            } else {
                                newEdgePoints = fromEdgePoints.slice();
                            }
                            newEdgePoints.unshift(group.mp0);
                            newEdgePoints.push(group.mp1);
                            newEdgePoints.unshift(edge.getStartPoint());
                            newEdgePoints.push(edge.getEndPoint());
                            newEdges.push({
                                points: cleanEdgePoints(newEdgePoints, edge.edge.points),
                                rawEdge: edge.edge
                            });
                        }
                    }
                }
            };

            buildNewEdges(res.groups);

            return newEdges;
        },

        _iterate: function (rawEdges) {
            var edges = [];
            var groups = [];
            var totalSavedInk = 0;
            for (var i = 0; i < rawEdges.length; i++) {
                var edge = new Edge(rawEdges[i]);
                edges.push(edge);
            }

            var tree = new KDTree(edges, 4);

            var nearests = [];

            var _mp0 = v2Create();
            var _mp1 = v2Create();
            var _newGroupInk = 0;
            var mp0 = v2Create();
            var mp1 = v2Create();
            var newGroupInk = 0;
            for (var i = 0; i < edges.length; i++) {
                var edge = edges[i];
                if (edge.group) {
                    // Edge have been groupped
                    continue;
                }
                tree.nearestN(
                    edge, this.maxNearestEdge,
                    squaredDistance, nearests
                );
                var maxSavedInk = 0;
                var mostSavingInkEdge = null;
                var lastCheckedGroup = null;
                for (var j = 0; j < nearests.length; j++) {
                    var nearest = nearests[j];
                    var savedInk = 0;
                    if (nearest.group) {
                        if (nearest.group !== lastCheckedGroup) {
                            lastCheckedGroup = nearest.group;
                            _newGroupInk = this._calculateGroupEdgeInk(
                                nearest.group, edge, _mp0, _mp1
                            );
                            savedInk = nearest.group.ink + edge.ink - _newGroupInk;
                        }
                    }
                    else {
                        _newGroupInk = this._calculateEdgeEdgeInk(
                            edge, nearest, _mp0, _mp1
                        );
                        savedInk = nearest.ink + edge.ink - _newGroupInk;
                    }
                    if (savedInk > maxSavedInk) {
                        maxSavedInk = savedInk;
                        mostSavingInkEdge = nearest;
                        v2Copy(mp1, _mp1);
                        v2Copy(mp0, _mp0);
                        newGroupInk = _newGroupInk;
                    }
                }
                if (mostSavingInkEdge) {
                    totalSavedInk += maxSavedInk;
                    var group;
                    if (! mostSavingInkEdge.group) {
                        group = new BundledEdgeGroup();
                        groups.push(group);
                        group.addEdge(mostSavingInkEdge);
                    }
                    group = mostSavingInkEdge.group;
                    // Use the meet point and group ink calculated before
                    v2Copy(group.mp0, mp0);
                    v2Copy(group.mp1, mp1);
                    group.ink = newGroupInk;
                    mostSavingInkEdge.group.addEdge(edge);
                }
                else {
                    var group = new BundledEdgeGroup();
                    groups.push(group);
                    v2Copy(group.mp0, edge.getStartPoint());
                    v2Copy(group.mp1, edge.getEndPoint());
                    group.ink = edge.ink;
                    group.addEdge(edge);
                }
            }

            return {
                groups: groups,
                edges: edges,
                savedInk: totalSavedInk
            };
        },

        _calculateEdgeEdgeInk: (function () {
            var startPointSet = [];
            var endPointSet = [];
            return function (e0, e1, mp0, mp1) {
                startPointSet[0] = e0.getStartPoint();
                startPointSet[1] = e1.getStartPoint();
                endPointSet[0] = e0.getEndPoint();
                endPointSet[1] = e1.getEndPoint();

                this._calculateMeetPoints(
                    startPointSet, endPointSet, mp0, mp1
                );
                var ink = v2Dist(startPointSet[0], mp0)
                    + v2Dist(mp0, mp1)
                    + v2Dist(mp1, endPointSet[0])
                    + v2Dist(startPointSet[1], mp0)
                    + v2Dist(mp1, endPointSet[1]);

                return ink;
            };
        })(),

        _calculateGroupEdgeInk: function (group, edgeTryAdd, mp0, mp1) {
            var startPointSet = [];
            var endPointSet = [];
            for (var i = 0; i < group.edgeList.length; i++) {
                var edge = group.edgeList[i];
                startPointSet.push(edge.getStartPoint());
                endPointSet.push(edge.getEndPoint());
            }
            startPointSet.push(edgeTryAdd.getStartPoint());
            endPointSet.push(edgeTryAdd.getEndPoint());

            this._calculateMeetPoints(
                startPointSet, endPointSet, mp0, mp1
            );

            var ink = v2Dist(mp0, mp1);
            for (var i = 0; i < startPointSet.length; i++) {
                ink += v2Dist(startPointSet[i], mp0)
                    + v2Dist(endPointSet[i], mp1);
            }

            return ink;
        },

        /**
         * Calculating the meet points
         * @method
         * @param {Array} startPointSet Start points set of bundled edges
         * @param {Array} endPointSet End points set of bundled edges
         * @param {Array.<number>} mp0 Output meet point 0
         * @param {Array.<number>} mp1 Output meet point 1
         */
        _calculateMeetPoints: (function () {
            var cp0 = v2Create();
            var cp1 = v2Create();
            return function (startPointSet, endPointSet, mp0, mp1) {
                vec2.set(cp0, 0, 0);
                vec2.set(cp1, 0, 0);
                var len = startPointSet.length;
                // Calculate the centroid of start points set
                for (var i = 0; i < len; i++) {
                    vec2.add(cp0, cp0, startPointSet[i]);
                }
                vec2.scale(cp0, cp0, 1 / len);

                // Calculate the centroid of end points set
                len = endPointSet.length;
                for (var i = 0; i < len; i++) {
                    vec2.add(cp1, cp1, endPointSet[i]);
                }
                vec2.scale(cp1, cp1, 1 / len);

                this._limitTurningAngle(
                    startPointSet, cp0, cp1, mp0
                );
                this._limitTurningAngle(
                    endPointSet, cp1, cp0, mp1
                );
            };
        })(),

        _limitTurningAngle: (function () {
            var v10 = v2Create();
            var vTmp = v2Create();
            var project = v2Create();
            var tmpOut = v2Create();
            return function (pointSet, p0, p1, out) {
                // Limit the max turning angle
                var maxTurningAngleCos = Math.cos(this.maxTurningAngle);
                var maxTurningAngleTan = Math.tan(this.maxTurningAngle);

                vec2.sub(v10, p0, p1);
                vec2.normalize(v10, v10);

                // Simply copy the centroid point if no need to turn the angle
                vec2.copy(out, p0);

                var maxMovement = 0;
                for (var i = 0; i < pointSet.length; i++) {
                    var p = pointSet[i];
                    vec2.sub(vTmp, p, p0);
                    var len = vec2.len(vTmp);
                    vec2.scale(vTmp, vTmp, 1 / len);
                    var turningAngleCos = vec2.dot(vTmp, v10);
                    // Turning angle is to large
                    if (turningAngleCos < maxTurningAngleCos) {
                        // Calculat p's project point on vector p1-p0 
                        // and distance to the vector
                        vec2.scaleAndAdd(
                            project, p0, v10, len * turningAngleCos
                        );
                        var distance = v2Dist(project, p);

                        // Use the max turning angle to calculate the new meet point
                        var d = distance / maxTurningAngleTan;
                        vec2.scaleAndAdd(tmpOut, project, v10, -d);

                        var movement = v2DistSquare(tmpOut, p0);
                        if (movement > maxMovement) {
                            maxMovement = movement;
                            vec2.copy(out, tmpOut);
                        }
                    }
                }
            };
        })()
    };

    return EdgeBundling;
});