(function(angular) {
    'use strict';

    function isDnDsSupported() {
        return 'ondrag' in document.createElement('a');
    }

    if (!isDnDsSupported()) {
        angular.module('ang-drag-drop', []);
        return;
    }

    if (window.jQuery && (-1 === window.jQuery.event.props.indexOf('dataTransfer'))) {
        window.jQuery.event.props.push('dataTransfer');
    }

    var module = angular.module('ang-drag-drop', []);

    module.directive('uiDraggable', ['$parse', '$rootScope', '$dragImage', function($parse, $rootScope, $dragImage) {
        return function(scope, element, attrs) {
            var isDragHandleUsed = false,
                dragHandleClass,
                draggingClass = attrs.draggingClass || 'on-dragging',
                dragTarget;

            element.attr('draggable', false);

            scope.$watch(attrs.uiDraggable, function(newValue) {
                if (newValue) {
                    element.attr('draggable', newValue);
                    element.bind('dragend', dragendHandler);
                    element.bind('dragstart', dragstartHandler);
                }
                else {
                    element.removeAttr('draggable');
                    element.unbind('dragend', dragendHandler);
                    element.unbind('dragstart', dragstartHandler);
                }

            });

            if (angular.isString(attrs.dragHandleClass)) {
                isDragHandleUsed = true;
                dragHandleClass = attrs.dragHandleClass.trim() || 'drag-handle';

                element.bind('mousedown', function(e) {
                    dragTarget = e.target;
                });
            }

            function dragendHandler(e) {
                setTimeout(function() {
                    element.unbind('$destroy', dragendHandler);
                }, 0);
                var sendChannel = attrs.dragChannel || 'defaultchannel';
                $rootScope.$broadcast('ANGULAR_DRAG_END', e, sendChannel);
                if (e.dataTransfer && e.dataTransfer.dropEffect !== 'none') {
                    if (attrs.onDropSuccess) {
                        var onDropSuccessFn = $parse(attrs.onDropSuccess);
                        scope.$evalAsync(function() {
                            onDropSuccessFn(scope, {$event: e});
                        });
                    } else {
                        if (attrs.onDropFailure) {
                            var onDropFailureFn = $parse(attrs.onDropFailure);
                            scope.$evalAsync(function() {
                                onDropFailureFn(scope, {$event: e});
                            });
                        }
                    }
                }
                element.removeClass(draggingClass);
            }

            function dragstartHandler(e) {
                var isDragAllowed = !isDragHandleUsed || dragTarget.classList.contains(dragHandleClass);

                if (isDragAllowed) {
                    var sendChannel = attrs.dragChannel || 'defaultchannel';
                    var dragData = '';
                    if (attrs.drag) {
                        dragData = scope.$eval(attrs.drag);
                    }

                    var dragImage = attrs.dragImage || null;

                    element.addClass(draggingClass);
                    element.bind('$destroy', dragendHandler);

                    if (dragImage) {
                        var dragImageFn = $parse(attrs.dragImage);
                        scope.$apply(function() {
                            var dragImageParameters = dragImageFn(scope, {$event: e});
                            if (dragImageParameters) {
                                if (angular.isString(dragImageParameters)) {
                                    dragImageParameters = $dragImage.generate(dragImageParameters);
                                }
                                if (dragImageParameters.image) {
                                    var xOffset = dragImageParameters.xOffset || 0,
                                        yOffset = dragImageParameters.yOffset || 0;
                                    e.dataTransfer.setDragImage(dragImageParameters.image, xOffset, yOffset);
                                }
                            }
                        });
                    }

                    var transferDataObject = {data: dragData, channel: sendChannel}
                    var transferDataText = angular.toJson(transferDataObject);

                    e.dataTransfer.setData('text', transferDataText);
                    e.dataTransfer.effectAllowed = 'copyMove';

                    $rootScope.$broadcast('ANGULAR_DRAG_START', e, sendChannel, transferDataObject);
                }
                else {
                    e.preventDefault();
                }
            }
        };
    }
    ]);

    module.directive('uiOnDrop', ['$parse', '$rootScope', function($parse, $rootScope) {
        return function(scope, element, attr) {
            var dragging = 0; //Ref. http://stackoverflow.com/a/10906204
            var dropChannel = attr.dropChannel || 'defaultchannel';
            var dragChannel = '';
            var dragEnterClass = attr.dragEnterClass || 'on-drag-enter';
            var dragHoverClass = attr.dragHoverClass || 'on-drag-hover';
            var customDragEnterEvent = $parse(attr.onDragEnter);
            var customDragLeaveEvent = $parse(attr.onDragLeave);

            function onDragOver(e) {
                if (e.preventDefault) {
                    e.preventDefault(); // Necessary. Allows us to drop.
                }

                if (e.stopPropagation) {
                    e.stopPropagation();
                }

                var uiOnDragOverFn = $parse(attr.uiOnDragOver);
                scope.$evalAsync(function() {
                    uiOnDragOverFn(scope, {$event: e, $channel: dropChannel});
                });

                return false;
            }

            function onDragLeave(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }

                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                dragging--;

                if (dragging === 0) {
                    scope.$evalAsync(function() {
                        customDragLeaveEvent(scope, {$event: e, $channel: dropChannel});
                    });
                    element.addClass(dragEnterClass);
                    element.removeClass(dragHoverClass);
                }

                var uiOnDragLeaveFn = $parse(attr.uiOnDragLeave);
                scope.$evalAsync(function() {
                    uiOnDragLeaveFn(scope, {$event: e, $channel: dropChannel});
                });
            }

            function onDragEnter(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }

                if (e.stopPropagation) {
                    e.stopPropagation();
                }

                if (dragging === 0) {
                    scope.$evalAsync(function() {
                        customDragEnterEvent(scope, {$event: e, $channel: dropChannel});
                    });
                    element.removeClass(dragEnterClass);
                    element.addClass(dragHoverClass);
                }
                dragging++;

                var uiOnDragEnterFn = $parse(attr.uiOnDragEnter);
                scope.$evalAsync(function() {
                    uiOnDragEnterFn(scope, {$event: e, $channel: dropChannel});
                });

                $rootScope.$broadcast('ANGULAR_HOVER', dragChannel);
            }

            function onDrop(e) {
                if (e.preventDefault) {
                    e.preventDefault(); // Necessary. Allows us to drop.
                }
                if (e.stopPropagation) {
                    e.stopPropagation(); // Necessary. Allows us to drop.
                }

                var sendData = e.dataTransfer.getData('text');
                sendData = angular.fromJson(sendData);

                // Chrome doesn't set dropEffect, so we have to work it out ourselves
                if (e.dataTransfer.dropEffect === 'none') {
                    if (e.dataTransfer.effectAllowed === 'copy' ||
                        e.dataTransfer.effectAllowed === 'move') {
                        e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed;
                    } else if (e.dataTransfer.effectAllowed === 'copyMove') {
                        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                    }
                }

                var uiOnDropFn = $parse(attr.uiOnDrop);
                scope.$evalAsync(function() {
                    uiOnDropFn(scope, {$data: sendData.data, $event: e, $channel: sendData.channel});
                });
                element.removeClass(dragEnterClass);
                dragging = 0;
            }

            function isDragChannelAccepted(dragChannel, dropChannel) {
                if (dropChannel === '*') {
                    return true;
                }

                var channelMatchPattern = new RegExp('(\\s|[,])+(' + dragChannel + ')(\\s|[,])+', 'i');

                return channelMatchPattern.test(',' + dropChannel + ',');
            }

            function preventNativeDnD(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.dataTransfer.dropEffect = 'none';
                return false;
            }

            var deregisterDragStart = $rootScope.$on('ANGULAR_DRAG_START', function(_, e, channel, transferDataObject) {
                dragChannel = channel;

                var valid = true;

                if (!isDragChannelAccepted(channel, dropChannel)) {
                    valid = false;
                }

                if (valid && attr.dropValidate) {
                    var validateFn = $parse(attr.dropValidate);
                    valid = validateFn(scope, {$drop: {scope: scope, element:element}, $event:e, $data: transferDataObject.data, $channel: transferDataObject.channel});
                }

                if (valid) {
                    element.bind('dragover', onDragOver);
                    element.bind('dragenter', onDragEnter);
                    element.bind('dragleave', onDragLeave);
                    element.bind('drop', onDrop);

                    element.addClass(dragEnterClass);
                } else {
                    element.bind('dragover', preventNativeDnD);
                    element.bind('dragenter', preventNativeDnD);
                    element.bind('dragleave', preventNativeDnD);
                    element.bind('drop', preventNativeDnD);

                    element.removeClass(dragEnterClass);
                }

            });


            var deregisterDragEnd = $rootScope.$on('ANGULAR_DRAG_END', function(_, e, channel) {
                element.unbind('dragover', onDragOver);
                element.unbind('dragenter', onDragEnter);
                element.unbind('dragleave', onDragLeave);

                element.unbind('drop', onDrop);
                element.removeClass(dragHoverClass);
                element.removeClass(dragEnterClass);

                element.unbind('dragover', preventNativeDnD);
                element.unbind('dragenter', preventNativeDnD);
                element.unbind('dragleave', preventNativeDnD);
                element.unbind('drop', preventNativeDnD);
            });

            scope.$on('$destroy', function() {
                deregisterDragStart();
                deregisterDragEnd();
            });


            attr.$observe('dropChannel', function(value) {
                if (value) {
                    dropChannel = value;
                }
            });


        };
    }
    ]);

    module.constant('$dragImageConfig', {
        height: 20,
        width: 200,
        padding: 10,
        font: 'bold 11px Arial',
        fontColor: '#eee8d5',
        backgroundColor: '#93a1a1',
        xOffset: 0,
        yOffset: 0
    });

    module.service('$dragImage', ['$dragImageConfig', function(defaultConfig) {
        var ELLIPSIS = '…';

        function fitString(canvas, text, config) {
            var width = canvas.measureText(text).width;
            if (width < config.width) {
                return text;
            }
            while (width + config.padding > config.width) {
                text = text.substring(0, text.length - 1);
                width = canvas.measureText(text + ELLIPSIS).width;
            }
            return text + ELLIPSIS;
        }

        this.generate = function(text, options) {
            var config = angular.extend({}, defaultConfig, options || {});
            var el = document.createElement('canvas');

            el.height = config.height;
            el.width = config.width;

            var canvas = el.getContext('2d');

            canvas.fillStyle = config.backgroundColor;
            canvas.fillRect(0, 0, config.width, config.height);
            canvas.font = config.font;
            canvas.fillStyle = config.fontColor;

            var title = fitString(canvas, text, config);
            canvas.fillText(title, 4, config.padding + 4);

            var image = new Image();
            image.src = el.toDataURL();

            return {
                image: image,
                xOffset: config.xOffset,
                yOffset: config.yOffset
            };
        };
    }
    ]);

}(angular));
