/*
 * Angular 1.x Integration
 *
 * Copyright 2017 jsPlumb
 * https://jsplumbtoolkit.com
 *
 * This software is not free.
 *
 */
;
(function () {

    var _noop = function () { };

    var _link = function (fn) {
        return function (scope, element, attrs, controller) {
            fn.apply(fn, arguments);
            var _resync = function () {

                // if this is a group, under certain circumstances the usual mechanism for making a node a child of the
                // group's dom element could have been undone by Angular not having finished painting the group at
                // the time that the node elements are added. the result is that the node elements end up getting
                // removed. so this code (in conjunction with a nodeAdded listener on the surface), takes care
                // of resetting everything to the way it should have been.
                if (scope.group) {
                    var target = element[0].querySelector("[jtk-group-content]") || element[0];
                    if (element[0]._jtkGroupProcessed !== true && element[0]._jtkGroupNodes) {

                        for (var i = 0; i < element[0]._jtkGroupNodes.length;i++) {
                            target.appendChild(element[0]._jtkGroupNodes[i].el);
                        }

                        delete element[0]._jtkGroupNodes;
                    }
                    target.setAttribute("jtk-group-content", "true");
                    element[0]._jtkGroupProcessed = true;
                }

                // post event to toolkit controller upstream
                scope.$emit("refresh", scope.node || scope.group);
            };
            scope.$watch(null, _resync);  // for the first paint
            scope.$watchCollection(scope.node ? "node" : "group", _resync);  // for subsequent data changes.
        };
    };

    var _inherit = function(scope, prop) {
        var pn = scope.$parent, value = scope[prop];
        while(pn != null && value == null) {
            value = pn[prop];
            pn = pn.$parent;
        }
        if (value != null) {
            scope[prop] = value;
        }
    };

    angular.module('$jsPlumb', [])

        .factory('jsPlumbFactory', ['$compile', 'jsPlumbService', '$timeout',  function ($compile, jsPlumbService, $timeout) {

            return {
                /**
                 * Create an instance of the jsPlumb Toolkit.
                 * @method instance
                 * @param params
                 *
                 */
                instance: function (params) {
                    params = params || {};
                    return {
                        restrict: "E",
                        template: params.template || "<div class='jtk-angular-directive' style='height:100%;' ng-transclude></div>",
                        transclude:true,
                        scope: {
                            renderParams: "=",
                            params: "=",
                            data: "=",
                            format: "=",
                            jtkId: "@",
                            surfaceId: "@",
                            init: "="
                        },
                        replace: params.replace,
                        controller: ['$scope', '$attrs', function ($scope, $attrs) {
                            this.jtk = jsPlumbService.getToolkit($attrs.jtkId, $scope.params);
                            this.data = $scope.data;
                            $scope.toolkit = this.jtk;
                            var self = this;
                            $scope.$on("refresh", function (e, node) {
                                self.jtk.updateNode(node);
                            });

                            params.controller && params.controller.apply(this, arguments);
                        }],
                        controllerAs: params.controllerAs,
                        link: function (scope, element, attrs, controller) {
                            var jtk = controller.jtk, args = arguments;
                            var p = jsPlumb.extend({}, scope.renderParams);
                            // must configure a miniview using the directive when using angular. otherwise
                            // there is a clash.
                            delete p.miniview;
                            var dataFormat = attrs.format;
                            var deferredEdgesPainted = 0;
                            jsPlumb.extend(p, {
                                container: params.replace ? element[0] : element[0].childNodes[0],
                                templateRenderer: function (directiveId, data, _toolkit, objectType) {
                                    var newScope = scope.$new();
                                    newScope[objectType] = data;
                                    newScope.toolkit = scope.toolkit;
                                    newScope.surface = scope.surface;
                                    var newNode = angular.element('<' + directiveId + ' ' + objectType + '="' + objectType + '" toolkit="toolkit" surface="surface"></' + directiveId + '>');
                                    $compile(newNode)(newScope);
                                    return newNode;
                                },
                                id: attrs.surfaceId
                            });
                            // create an id for this renderer if one does not exist.
                            p.id = p.id || jsPlumbToolkitUtil.uuid();

                            // in angular, disable enhanced views; it interfers with the two way data binding because
                            // it makes a copy of the original data.
                            p.enhancedView = false;

                            p.connectionHandler = function (edge, connectFn) {
                                deferredEdgesPainted++;
                                $timeout(connectFn);
                            };

                            // configure miniview if supplied as an attribute on the directive.
                            if (attrs.miniview != null) {
                                p.miniview = {
                                    container: attrs.miniview
                                };
                            }

                            jsPlumbToolkit.ready(function () {
                                // write the Surface into the controller's scope
                                scope.surface = jtk.render(p);
                                // register on the service
                                jsPlumbService.addSurface(p.id, scope.surface);

                                scope.surface.bind("nodeAdded", function(data) {
                                    if (data.node.group) {
                                        var groupEl = scope.surface.getRenderedGroup(data.node.group.id);
                                        if (groupEl) {
                                            if (groupEl._jtkGroupProcessed !== true) {
                                                groupEl._jtkGroupNodes  = groupEl._jtkGroupNodes || [];
                                                groupEl._jtkGroupNodes.push(data);
                                            }
                                        }
                                    }
                                });

                                // bind to nodeUpdated event and apply the scope, to get changes
                                // through to the view layer.
                                scope.toolkit.bind("nodeUpdated", function() {
                                    $timeout(function() { scope.$apply(); });
                                });

                                scope.toolkit.bind("dataLoadStart", function() {
                                    deferredEdgesPainted = 0;
                                });

                                scope.toolkit.bind("dataLoadEnd", function() {
                                    if (deferredEdgesPainted > 0) {
                                        $timeout(scope.surface.getJsPlumb().getGroupManager().refreshAllGroups);
                                    }
                                    deferredEdgesPainted = 0;
                                });

                                // if user supplied a link function, call it.
                                params.link && params.link.apply(this, args);

                                if (scope.data) {
                                    jtk.load({ data: scope.data, type: dataFormat });
                                }

                                if (scope.init) {
                                    $timeout(function() {
                                        scope.init.apply(scope, args);
                                    });
                                }
                            });

                            params.link && params.link.apply(this, arguments);

                        }
                    };
                },
                node: function (params) {
                    var out = {};
                    jsPlumb.extend(out, params || {});
                    out.restrict = "E";
                    out.scope = out.scope || {};
                    out.scope.node = "=";
                    out.scope.toolkit = "=";
                    out.scope.surface = "=";
                    out.link = _link(out.link || _noop);
                    if (params.inherit) {
                        if (out.controller == null) {
                            out.controller = ["$scope", function ($scope) {
                                for (var i = 0; i < params.inherit.length; i++) {
                                    _inherit($scope, params.inherit[i]);
                                }
                            }];
                        }
                        else if (out.controller.length != null) {
                            // an array. check if the array contains $scope.
                            var idx = out.controller.indexOf("$scope"), scopeAdded = false;
                            if (idx == -1) {
                                out.controller.unshift("$scope");
                                idx = 0;
                                scopeAdded = true;
                            }

                            var fn = out.controller.pop();
                            out.controller.push(function() {
                                for (var i = 0; i < params.inherit.length; i++) {
                                    _inherit(arguments[idx], params.inherit[i]);
                                }
                                fn.apply(this, scopeAdded ? arguments.slice(1) : arguments);
                            });
                        }
                        else {
                            throw new TypeError("Controller spec must be in strict format to use inherit parameter with jsPlumb Angular integration");
                        }
                    }
                    return out;
                },

                group: function (params) {
                    var out = {};
                    jsPlumb.extend(out, params || {});
                    out.restrict = "E";
                    out.scope = out.scope || {};
                    out.scope.group = "=";
                    out.scope.toolkit = "=";
                    out.scope.surface = "=";
                    out.link = _link(out.link || _noop);
                    if (params.inherit) {
                        if (out.controller == null) {
                            out.controller = ["$scope", function ($scope) {
                                for (var i = 0; i < params.inherit.length; i++) {
                                    _inherit($scope, params.inherit[i]);
                                }
                            }];
                        }
                        else if (out.controller.length != null) {
                            // an array. check if the array contains $scope.
                            var idx = out.controller.indexOf("$scope"), scopeAdded = false;
                            if (idx == -1) {
                                out.controller.unshift("$scope");
                                idx = 0;
                                scopeAdded = true;
                            }

                            var fn = out.controller.pop();
                            out.controller.push(function() {
                                for (var i = 0; i < params.inherit.length; i++) {
                                    _inherit(arguments[idx], params.inherit[i]);
                                }
                                fn.apply(this, scopeAdded ? arguments.slice(1) : arguments);
                            });
                        }
                        else {
                            throw new TypeError("Controller spec must be in strict format to use inherit parameter with jsPlumb Angular integration");
                        }
                    }
                    return out;
                },


                /**
                 * Generate a Miniview directive.
                 * @method miniview
                 * @return {Object} A Miniview directive definition.
                 */
                miniview: function (params) {
                    return {
                        restrict: "AE",
                        scope: {
                            surfaceId: "@"
                        },
                        replace: true,
                        template: "<div></div>",
                        link: function (scope, element, attrs) {
                            var _init = function () {
                                jsPlumbService.addMiniview(attrs.surfaceId, {
                                    container: element
                                });
                            };
                            scope.$watch(null, _init);  // workaround angular async paint.
                        }
                    };
                }
            };
        }])

        .service("jsPlumbService", [ '$templateCache', '$timeout', function ($templateCache, $timeout) {

            var eg = new jsPlumbUtil.EventGenerator(),
                _toolkits = {},
                _newToolkit = function (id, params) {
                    var tk = jsPlumbToolkit.newInstance(params || {});
                    tk._ngId = id;
                    _toolkits[id] = tk;
                    eg.fire("ready", { id: id, toolkit: tk });
                    return tk;
                },
                _surfaces = {},
                _workQueues = {},
                _handlers = {
                    "palette": function (surface, params) {
                        surface.registerDroppableNodes({
                            droppables: params.selector(params.element),
                            dragOptions: params.dragOptions,
                            typeExtractor: params.typeExtractor,
                            dataGenerator: params.dataGenerator,
                            locationSetter: params.locationSetter,
                            onDrop:params.onDrop
                        });
                    },
                    "miniview": function (surface, params) {
                        var miniview = surface.createMiniview({
                            container: params.container
                        });
                        surface.getToolkit().bind("dataLoadEnd", function() {
                            $timeout(miniview.invalidate);
                        });

                        surface.getToolkit().bind("nodeAdded", function(params) {
                            $timeout(function() { miniview.invalidate(params.node.id); });
                        });
                    }
                },
                _addToWorkQueue = function (surfaceId, params, handler) {
                    var s = _surfaces[surfaceId];
                    if (s) {
                        handler(s, params);
                    }
                    else {
                        _workQueues[surfaceId] = _workQueues[surfaceId] || [];
                        _workQueues[surfaceId].push([params, handler]);
                    }
                };

            /**
             * Binds to some event related to the toolkit with the given id, which may or may not yet exist, and in fact
             * for the case for which this functionality was added - a ready event - it most likely does not.
             * @method bind
             * @param {String} event ID of the event to bind to. Currently we support `ready` only.
             * @param {String} toolkitId ID of the Toolkit to bind the event to.
             * @param {Function} callback Function to call when the event fires. The function is passed (toolkit, toolkitId, eventId) as args.
             */
            this.bind = function (event, toolkitId, callback) {
                eg.bind(event, function (p) {
                    if (p.id == toolkitId)
                        callback(p.toolkit, toolkitId, event);
                });
            };

            /**
             * Gets an instance of the jsPlumb Toolkit by the ID used to create it.
             * @method getToolkit
             * @param {String} id ID used to create the Toolkit instance you want to retrieve.
             * @param {Object} [params] Optional parameters for the Toolkit instance's constructor.
             * @return {jsPlumbToolkitInstance} An instance of the jsPlumb Toolkit; null if not found.
             */
            this.getToolkit = function (id, params) {
                id = id || jsPlumbToolkitUtil.uuid();
                if (_toolkits[id] != null) return _toolkits[id];
                else {
                    return _newToolkit(id, params);
                }
            };

            /**
             * Resets the toolkit with the given id - which is to say, deletes it, so that the next request
             * for it returns null and it gets recreated.
             * @method resetToolkit
             * @param {String} id ID of the toolkit to reset.
             */
            this.resetToolkit = function (id) {
                var tk = _toolkits[id];
                if (tk) {
                    tk.clear();
                    var rs = tk.getRenderers();
                    if (rs != null)
                        for (var r in rs) delete _surfaces[rs[r]._ngId];

                    delete _toolkits[id];
                }
            };

            /**
             * Registers a Surface. If any extra components have been registered for this Surface they will be initialised now.
             * @method addSurface
             * @param {String} id ID to register the Surface with.
             * @param {Surface} surface Surface instance.
             */
            this.addSurface = function (id, surface) {
                _surfaces[id] = surface;
                surface._ngId = id;
                if (_workQueues[id]) {
                    for (var i = 0; i <_workQueues[id].length; i++) {
                        try {
                            _workQueues[id][i][1](surface, _workQueues[id][i][0]);
                        }
                        catch (e) {
                            if (typeof console != "undefined")
                                console.log("Cannot create component " + e);
                        }
                    }
                }
                delete _workQueues[id];
            };

            /**
             * Retrieve a Surface by id. You will have set the id of the Surface via the `surface-id` attribute on the directive
             * element.
             * @method getSurface
             * @param {String} id ID of the Surface to retrieve.
             */
            this.getSurface = function (id) {
                return _surfaces[id];
            };

            /**
             * Add a component to the Surface with the given id. If the Surface already exists and has been initialised the component
             * will be added immediately; otherwise it will be enqueued for later processing.
             * @method addComponent
             * @param {String} surfaceId ID of the Surface to add the component to.
             * @param {Object} params Constructor parameters for the component.
             * @param {String} type Type of component to add.
             */
            this.addComponent = function (surfaceId, params, type) {
                _addToWorkQueue(surfaceId, params, _handlers[type]);
            };

            /**
             * Add a Palette to the Surface with the given id. If the Surface already exists and has been initialised the Palette
             * will be added immediately; otherwise it will be enqueued for later processing. This is really just a wrapper around
             * addComponent.
             * @method addPalette
             * @param {String} surfaceId ID of the Surface to add the Palette to.
             * @param {Object} params Constructor parameters for the Palette.
             */
            this.addPalette = function (surfaceId, params) {
                this.addComponent(surfaceId, params, "palette");
            };

            /**
             * Add a Miniview to the Surface with the given id. If the Surface already exists and has been initialised the Miniview
             * will be added immediately; otherwise it will be enqueued for later processing. This is just a wrapper around addComponent.
             * @method addMiniview
             * @param {String} surfaceId ID of the Surface to add the Miniview to.
             * @param {Object} params Constructor parameters for the Miniview.
             */
            this.addMiniview = function (surfaceId, params) {
                this.addComponent(surfaceId, params, "miniview");
            };

        }])

        .directive('jsplumbMiniview', [ 'jsPlumbFactory' , function(jsPlumbFactory) {
            return jsPlumbFactory.miniview();
        }])

    /**
     * Provides an angular directive to create an instance of the Toolkit. Params discussed here are
     * provided as attributes to the element, for instance:
     *
     * <jsplumb-toolkit jtk-id="myToolkit" params="SomeController.myToolkitParams" .../>
     *
     * Note that of course since they are attributes then their real types are String, but the types discussed
     * here are the required types of objects resolved through Angular's DI.
     *
     * @class jsPlumbToolkit directive.
     * @param {String} [jtk-id] ID of the Toolkit to create. You will want to use this if you need to subsequently
     * access the Toolkit instance from the `jsPlumbService`.
     * @param {String} [surface-id] Optional ID of the Surface widget.
     * @param {Object} [params] Optional parameters for the Toolkit constructor.
     * @param {Object} [renderParams] Optional parameters for the Surface widget. It is highly likely you will
     * want to supply something here.
     * @param {Object} [data] Optional data to load at create time.
     * @param {Function} [init] Optional function to call back at the end of the Toolkit's `link` function.
     * This function is passed the current scope (which contains the Toolkit and Surface objects), as well as the
     * element into which the Toolkit was rendered, and the attributes that were set on the `jsplumb-toolkit` element.
     */
        .directive('jsplumbToolkit', [ 'jsPlumbFactory', function(jsPlumbFactory) {
            return jsPlumbFactory.instance();
        }])

    /**
     * Provides an Angular directive for configuring a set of droppable nodes for a Surface.
     *
     * @class jsPlumb Palette directive
     * @param {Function} typeExtractor Function used to extract the type of a dropped node from the element that was dropped.
     * @param {Function} [dataGenerator] Optional function that can prepare some initial data for a dropped node.
     * @param {Object} [dragOptions] Options for the drag. If these are omitted then some sensible (at least, what
     * jsPlumb considers sensible) defaults are used.
     * @param {Function} [onDrop] Optional function to call after a Node or Group is dropped. The new Node or Group is passed
     * as a paremeter to the provided function.
     */
        .directive('jsplumbPalette', [ 'jsPlumbService', '$timeout', function(jsPlumbService, $timeout) {
            return {
                restrict:'AE',
                scope:{
                    typeExtractor:"=",
                    generator:"=",
                    dragOptions:"=",
                    locationSetter:"=",
                    onDrop:"="
                },
                link:function($scope, element, attrs) {
                    $timeout(function() {
                        var surface = jsPlumbService.getSurface(attrs.surfaceId);
                        if (surface) {
                            $scope.droppablesHandler = surface.registerDroppableNodes({
                                source: element[0],
                                selector:attrs.selector,
                                dragOptions: $scope.dragOptions || {
                                    zIndex: 50000,
                                    cursor: "move",
                                    clone: true
                                },
                                typeExtractor: $scope.typeExtractor,
                                dataGenerator: $scope.generator,
                                locationSetter:$scope.locationSetter,
                                onDrop:$scope.onDrop
                            });
                        }
                    });
                    $scope.$on("draggableNodeLoaded", function () {
                        $scope.droppablesHandler.refresh();
                    });
                }
            }
        }]);

}).call(typeof window !== 'undefined' ? window : this);