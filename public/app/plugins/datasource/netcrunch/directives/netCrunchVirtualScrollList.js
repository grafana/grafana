/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-15
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

define([
    'angular'
  ],

  function (angular) {

    'use strict';

    var module = angular.module('grafana.directives');

    module.directive('ngVirtualScrollList', function ($compile, $timeout, $interval, $window,
                                                      $document) {

      var TAB_CODE = 9,
        SPACE_CODE = 32,
        PAGE_UP_CODE = 33,
        PAGE_DOWN_CODE = 34,
        END_CODE = 35,
        HOME_CODE = 36,
        LEFT_ARROW_CODE = 37,
        UP_ARROW_CODE = 38,
        RIGHT_ARROW_CODE = 39,
        DOWN_ARROW_CODE = 40,
        keyboardDelayTime = 30;

      function parseAttribute(attribute) {
        if (attribute != null) {
          return attribute.replace(/(\{\{)|(}})/g, ' ').trim();
        } else {
          return null;
        }
      }

      function checkEqualityObjectProperties(firstObject, secondObject, propertiesList) {
        if (Array.isArray(propertiesList) === true) {
          return !propertiesList.some(function(property) {
            return (firstObject[property] !== secondObject[property]);
          });
        }
        return false;
      }

      function getNgRepeatType(ngRepeatHtmlTemplate) {
        var types = Object.create(null),
          result = 'div';

        types.div = /^<div\s/;
        types.li = /^<li\s/;
        types.td = /^<td\s/;

        Object.keys(types).some(function(key) {
          if (ngRepeatHtmlTemplate.match(types[key]) != null) {
            result = key;
            return true;
          } else {
            return false;
          }
        });

        return result;
      }

      return {
        restrict: 'A',
        scope: true,

        compile: function($element) {
          var ngVirtualScrollListID = $element.attr('ng-virtual-scroll-list'),
            ngVirtualScrollListState = $element.attr('ng-virtual-scroll-list-state'),
            ngRepeatChild = $element.children().eq(0),
            ngRepeatExpression = ngRepeatChild.attr('ng-repeat'),
            ngRepeatHtmlTemplate = ngRepeatChild[0].outerHTML,
            ngRepeatHtmlType = getNgRepeatType(ngRepeatHtmlTemplate),
            ngRepeatTabIndex = parseAttribute(ngRepeatChild.attr('tabindex')),
            expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)(track\s+by\s+\S+)?$/.exec(ngRepeatExpression),
            ngRepeatItem = expressionMatches[1],
            ngRepeatStatement = expressionMatches[2],
            ngRepeatTrackBy = expressionMatches[3],
            ngRepeatItemHeight = ngRepeatChild.attr('ng-virtual-scroll-list-element-height'),
            ngVirtualScrollListKeyMode = (ngRepeatTabIndex != null),
            closestElement = angular.element.prototype.closest,
            isHorizontal,
            subSetElements = '$ngVirtualScrollListSubSetElements',
            virtualRangeIndex = '$ngVirtualScrollListVirtualRangeIndex',
            allElements = [],
            renderingModel;

          function checkScrollParent(scrollParent) {
            if (scrollParent.length === 0) {
              throw 'Specified scroll parent selector does not match any element';
            }
            return scrollParent;
          }

          function getScrollBoxSize(container) {
            return {
              height: container.clientHeight,
              width: container.clientWidth
            };
          }

          function calculateScrollBoxSize(container) {
            var scrollBoxSize = getScrollBoxSize(container);
            return (isHorizontal === true) ? scrollBoxSize.width : scrollBoxSize.height;
          }

          function getContainerScrollPosition(container) {
            var scrollPositionTag = isHorizontal ? 'scrollLeft' : 'scrollTop';
            return container[scrollPositionTag];
          }

          function setContainerScrollPosition(container, position) {
            var scrollPositionTag = isHorizontal ? 'scrollLeft' : 'scrollTop';
            container[scrollPositionTag] = position;
          }

          function findNodeIndexForPosition(renderingModel, YPosition) {

            function binarySearch(model, value, indexStart, indexEnd) {
              var midIndex = indexStart + Math.floor((indexEnd - indexStart) / 2),
                nodeModel = model[midIndex],
                nodeTop = nodeModel.top,
                nodeBottom = nodeTop + nodeModel.height;

              if ((nodeTop <= value) && (value <= nodeBottom)) {
                return midIndex;
              } else {
                if (value < nodeTop) {
                  return binarySearch(model, value, indexStart, midIndex - 1);
                }
                if (value > nodeBottom) {
                  return binarySearch(model, value, midIndex + 1, indexEnd);
                }
              }
            }

            YPosition = (YPosition > renderingModel.totalHeight) ? renderingModel.totalHeight : YPosition;
            return binarySearch(renderingModel, YPosition, 0, renderingModel.length - 1);
          }

          $element.empty();

          return {
            pre: function($scope, $element, $attributes) {
              var ngRepeatElement = angular.element(ngRepeatHtmlTemplate),
                scrollParent = closestElement.call($element, $attributes.ngVirtualScrollListParent)
                               || $element,
                scrollParentContainer,
                invisibleSpaces = {
                  leadingSpace: null,
                  followingSpace: null
                };

              function createFillElement(size, horizontal, htmlContainerType) {
                var htmlContainers = Object.create(null),
                  elementContainer,
                  fillElement,
                  minHeight = (horizontal === true) ? '' : '100%',
                  minWidth = (horizontal === true) ? '100%' : '',
                  height = (horizontal === true) ? size : '',
                  width = (horizontal === true) ? '' : size;

                htmlContainers.div = '<div></div>';
                htmlContainers.li = '<li></li>';
                htmlContainers.td = '<td></td>';
                elementContainer = htmlContainers[htmlContainerType];
                fillElement = angular.element(elementContainer);

                fillElement.css({
                  'background-color': 'transparent',
                  'border': '0px solid transparent',
                  'cursor': 'default',
                  'padding': '0',
                  'margin': '0',
                  'min-height': minHeight,
                  'min-width': minWidth,
                  'height': height,
                  'width': width,
                  'overflow': 'hidden'
                });
                return fillElement;
              }

              function createRenderingModel(elements) {
                var renderingModel = [],
                  currentHeight,
                  currentTop = 0,
                  lastModelIndex;

                function getElementAttribute(element, attribute) {
                  var elementScope,
                    result;

                  elementScope = $scope.$new(true);
                  elementScope[ngRepeatItem] = element;
                  result = elementScope.$eval(attribute);
                  elementScope.$destroy();
                  return result;
                }

                function getElementHeight(element) {
                  var elementHeight;

                  elementHeight = getElementAttribute(element, ngRepeatItemHeight);
                  if ((elementHeight == null) || (typeof elementHeight !== 'number')) {
                    elementHeight = 0;
                  }
                  return elementHeight;
                }

                function getElementTabIndex(element) {
                  return getElementAttribute(element, ngRepeatTabIndex);
                }

                if (ngVirtualScrollListKeyMode === true) {
                  renderingModel.tabIndexMap = Object.create(null);
                }

                elements.forEach(function(element, $index) {
                  var modelItem = Object.create(null);

                  currentHeight = getElementHeight(element);
                  modelItem.top = currentTop;
                  modelItem.height = currentHeight;

                  if (ngVirtualScrollListKeyMode === true) {
                    modelItem.tabindex = getElementTabIndex(element);
                    renderingModel.tabIndexMap[modelItem.tabindex] = $index;
                  }

                  renderingModel.push(modelItem);
                  currentTop += currentHeight;
                });

                if (renderingModel.length > 0) {
                  lastModelIndex = renderingModel.length - 1;
                  renderingModel.totalHeight = renderingModel[lastModelIndex].top + renderingModel[lastModelIndex].height;
                }
                return renderingModel;
              }

              function calculateVisibleRangeIndex(container) {

                var scrollTopPosition = getContainerScrollPosition(container),
                  scrollBoxHeight = getScrollBoxSize(container).height,
                  scrollBottomPosition = scrollTopPosition + scrollBoxHeight,
                  firstVirtualNodeIndex,
                  lastVirtualNodeIndex,
                  invisibleLeadingElementHeight,
                  invisibleFollowingElementHeight;

                if (scrollTopPosition === 0) {
                  firstVirtualNodeIndex = 0;
                  invisibleLeadingElementHeight = 0;
                } else {
                  firstVirtualNodeIndex = findNodeIndexForPosition(renderingModel, scrollTopPosition);
                  invisibleLeadingElementHeight = renderingModel[firstVirtualNodeIndex].top;
                }
                if (scrollBottomPosition >= renderingModel.totalHeight) {
                  lastVirtualNodeIndex = renderingModel.length - 1;
                  invisibleFollowingElementHeight = 0;
                } else {
                  lastVirtualNodeIndex = findNodeIndexForPosition(renderingModel, scrollBottomPosition);
                  invisibleFollowingElementHeight = renderingModel.totalHeight -
                                                    (renderingModel[lastVirtualNodeIndex].top
                                                     + renderingModel[lastVirtualNodeIndex].height);
                }

                return {
                  invisibleLeadingElementHeight: invisibleLeadingElementHeight,
                  firstVirtualNodeIndex: firstVirtualNodeIndex,
                  lastVirtualNodeIndex: lastVirtualNodeIndex,
                  invisibleFollowingElementHeight: invisibleFollowingElementHeight
                };
              }

              function createInvisibleSpaces() {
                return {
                  leadingSpace: createFillElement(0, !isHorizontal, ngRepeatHtmlType),
                  followingSpace: createFillElement(0, !isHorizontal, ngRepeatHtmlType)
                };
              }

              function updateSubSetElements() {
                var calculatedRangeIndex,
                  currentRangeIndex = $scope[virtualRangeIndex],
                  calculatedRI,
                  currentRI = currentRangeIndex,
                  emptyRangeIndex = {
                    invisibleLeadingElementHeight: 0,
                    firstVirtualNodeIndex: -1,
                    lastVirtualNodeIndex: -1,
                    invisibleFollowingElementHeight: 0
                  },
                  rangeIndexPropertyList = ['invisibleLeadingElementHeight', 'firstVirtualNodeIndex',
                                            'lastVirtualNodeIndex', 'invisibleFollowingElementHeight'];

                if ((renderingModel != null) && (renderingModel.length > 0)) {
                  calculatedRangeIndex = calculateVisibleRangeIndex(scrollParentContainer);
                  calculatedRI = calculatedRangeIndex;

                  if (currentRangeIndex == null) {
                    $scope[virtualRangeIndex] = calculatedRangeIndex;
                    $scope[subSetElements] = allElements.slice(
                      $scope[virtualRangeIndex].firstVirtualNodeIndex,
                      $scope[virtualRangeIndex].lastVirtualNodeIndex + 1);
                    return true;
                  } else {
                    if (checkEqualityObjectProperties(currentRI, calculatedRI, rangeIndexPropertyList)
                        === false) {
                      $scope[virtualRangeIndex] = calculatedRI;
                      $scope[subSetElements] = allElements.slice(
                        $scope[virtualRangeIndex].firstVirtualNodeIndex,
                        $scope[virtualRangeIndex].lastVirtualNodeIndex + 1);
                      return true;
                    } else {
                      return false;
                    }
                  }
                } else {
                  $scope[virtualRangeIndex] = emptyRangeIndex;
                  $scope[subSetElements] = [];
                  return true;
                }
              }

              function updateInvisibleElementSize(element, elementSize) {
                if (isHorizontal === true) {
                  element.css('width', elementSize + 'px');
                } else {
                  element.css('height', elementSize + 'px');
                }
              }

              function drawVirtualView() {
                var VRI = $scope[virtualRangeIndex];

                if (VRI != null) {
                  updateInvisibleElementSize(invisibleSpaces.leadingSpace,
                                             VRI.invisibleLeadingElementHeight);
                  ngRepeatElement.attr('ng-repeat', ngRepeatItem + ' in ' + subSetElements +
                                                    (ngRepeatTrackBy ? ' ' + ngRepeatTrackBy : ''));
                  $compile(ngRepeatElement)($scope);
                  ngRepeatElement.insertBefore(invisibleSpaces.followingSpace);
                  updateInvisibleElementSize(invisibleSpaces.followingSpace,
                                             VRI.invisibleFollowingElementHeight);
                }
              }

              function updateHandler() {
                var scrollPositionBefore,
                  scrollPositionAfter;

                if (updateSubSetElements() === true) {
                  scrollPositionBefore = getContainerScrollPosition(scrollParentContainer);
                  $scope.$apply();
                  scrollPositionAfter = getContainerScrollPosition(scrollParentContainer);
                  if (scrollPositionBefore !== scrollPositionAfter) {
                    $timeout(function() {
                      setContainerScrollPosition(scrollParentContainer, scrollPositionBefore);
                    }, 0);
                  }
                }
              }

              function registerEventListeners() {
                if ((ngVirtualScrollListID != null) && (ngVirtualScrollListID !== '')) {
                  $scope.$on('ngVirtualScrollListRefresh(' + ngVirtualScrollListID + ')',
                             function() {
                               updateHandler();
                             });
                }
              }

              scrollParent = checkScrollParent(scrollParent);
              $scope.scrollParent = scrollParent;
              scrollParentContainer = scrollParent[0];
              $scope.scrollParentContainer = scrollParentContainer;

              isHorizontal = false;

              invisibleSpaces = createInvisibleSpaces();
              $element.append(invisibleSpaces.leadingSpace);
              $element.append(invisibleSpaces.followingSpace);

              updateSubSetElements();
              drawVirtualView();

              $scope.$watchCollection(ngRepeatStatement, function(changedCollection) {
                allElements = changedCollection || [];
                renderingModel = createRenderingModel(allElements);
                $scope[virtualRangeIndex] = null;
                updateSubSetElements();
              });

              $scope.$watch(
                function() {
                  return (isHorizontal === true) ? scrollParentContainer.clientHeight
                    : scrollParentContainer.clientWidth;
                },
                function() {
                  updateSubSetElements();
                }
              );

              $scope.$watch(virtualRangeIndex, function() {
                drawVirtualView();
              });

              scrollParent.on('scroll', updateHandler);

              $window.addEventListener('resize', updateHandler, true);

              registerEventListeners();

              $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', updateHandler, true);
              });
            },

            post: function($scope, $element) {
              var ngRepeatElements = $element[0].children,
                ngRepeatEventHandlers = [],
                ngVirtualScrollListFocusedElement = null,
                hasComponentFocus = '$ngVirtualScrollListHasComponentFocus',
                virtualScrollListState,
                waitForFocusElement = false,
                keyboardTimer = false,
                keyboardEnable = true,
                intervalHandler;

              function keyboardDelay(delay) {
                keyboardEnable = false;

                if ((keyboardEnable === false) && (keyboardTimer === false)) {
                  keyboardTimer = true;

                  $timeout(function() {
                    keyboardTimer = false;
                    keyboardEnable = true;
                  }, delay);
                }
              }

              function setComponentFocus(state) {
                $scope[hasComponentFocus] = state;
              }

              function getComponentFocus() {
                return $scope[hasComponentFocus];
              }

              function getModelTabIndex(index) {
                if ((index >= 0) && (index < allElements.length)) {
                  return renderingModel[index].tabindex;
                } else {
                  return null;
                }
              }

              function getFirstModelTabIndex() {
                return getModelTabIndex(0);
              }

              function getLastModelTabIndex() {
                return getModelTabIndex(allElements.length - 1);
              }

              function getPrevItemsTabIndex(count) {
                return function(currentTabIndex) {
                  var itemIndex = calculateItemIndex(currentTabIndex);

                  if (itemIndex != null) {
                    itemIndex -= count;
                    itemIndex = (itemIndex > 0) ? itemIndex : 0;
                    return getModelTabIndex(itemIndex);
                  } else {
                    return null;
                  }
                };
              }

              function getPrevTabIndex(currentTabIndex) {
                return getPrevItemsTabIndex(1)(currentTabIndex);
              }

              function getNextItemsTabIndex(count) {
                return function(currentTabIndex) {
                  var itemIndex = calculateItemIndex(currentTabIndex),
                    lastItemIndex = allElements.length - 1;

                  if ((itemIndex != null) && (lastItemIndex >= 0)) {
                    itemIndex += count;
                    itemIndex = (itemIndex < lastItemIndex) ? itemIndex : lastItemIndex;
                    return getModelTabIndex(itemIndex);
                  } else {
                    return null;
                  }
                };
              }

              function getNextTabIndex(currentTabIndex) {
                return getNextItemsTabIndex(1)(currentTabIndex);
              }

              function getFirstVirtualTabIndex() {
                return getModelTabIndex($scope[virtualRangeIndex].firstVirtualNodeIndex);
              }

              function getLastVirtualTabIndex() {
                return getModelTabIndex($scope[virtualRangeIndex].lastVirtualNodeIndex);
              }

              function ngRepeatElementClickHandler(tabIndex) {
                return function() {
                  if (ngVirtualScrollListFocusedElement !== tabIndex) {
                    ngVirtualScrollListFocusedElement = tabIndex;
                    focusElement(ngVirtualScrollListFocusedElement);
                  }
                  setComponentFocus(true);
                };
              }

              function ngRepeatElementFocusHandler(tabIndex) {
                return function() {
                  if ((getComponentFocus() === true) || (ngVirtualScrollListFocusedElement == null) ||
                      (ngVirtualScrollListFocusedElement < getFirstModelTabIndex()) ||
                      (ngVirtualScrollListFocusedElement > getLastVirtualTabIndex())) {
                    ngVirtualScrollListFocusedElement = tabIndex;
                  } else {
                    focusElement(ngVirtualScrollListFocusedElement);
                  }
                  setComponentFocus(true);
                };
              }

              function ngRepeatElementKeyboardHandler(tabIndex) {

                return function(event) {
                  var keyMapper = Object.create(null);

                  keyMapper[TAB_CODE] = function(event) {
                    var tabIndexItems,
                      firstVirtualTabIndex,
                      lastVirtualTabIndex,
                      firstTabIndexPointer,
                      lastTabIndexPointer,
                      calculatedTabIndex,
                      changeFocus = true;

                    function sortTabIndexes(indexTabA, indexTabB) {
                      return indexTabA - indexTabB;
                    }

                    function prepareTabIndexItems() {
                      var visibleDOMItems,
                        item,
                        tabIndex,
                        tabIndexItems = Object.create(null);

                      visibleDOMItems = $document.find('*').filter(':visible');
                      tabIndexItems.index = [];

                      Object.keys(visibleDOMItems).forEach(function(key) {
                        if (isNaN(key) === false) {
                          item = angular.element(visibleDOMItems[key]);
                          tabIndex = item.attr('tabindex');
                          if (tabIndex != null) {
                            tabIndex = Number(tabIndex);
                            tabIndexItems.index.push(tabIndex);
                            tabIndexItems[tabIndex] = item;
                          }
                        }
                      });

                      tabIndexItems.index = tabIndexItems.index.sort(sortTabIndexes);
                      return tabIndexItems;
                    }

                    if (allElements.length > 0) {
                      tabIndexItems = prepareTabIndexItems();
                      if (tabIndexItems.index.length > 0) {
                        firstVirtualTabIndex = getFirstVirtualTabIndex();
                        lastVirtualTabIndex = getLastVirtualTabIndex();
                        firstTabIndexPointer = tabIndexItems.index.indexOf(firstVirtualTabIndex);
                        lastTabIndexPointer = tabIndexItems.index.indexOf(lastVirtualTabIndex);

                        if (event.shiftKey === true) {
                          if (firstTabIndexPointer > 0) {
                            calculatedTabIndex = tabIndexItems.index[firstTabIndexPointer - 1];
                          } else {
                            if (lastTabIndexPointer < tabIndexItems.index.length - 1) {
                              calculatedTabIndex = tabIndexItems.index[tabIndexItems.index.length - 1];
                            } else {
                              changeFocus = false;
                            }
                          }
                        } else {
                          if (lastTabIndexPointer < (tabIndexItems.index.length - 1)) {
                            calculatedTabIndex = tabIndexItems.index[lastTabIndexPointer + 1];
                          } else {
                            if (firstTabIndexPointer > 0) {
                              calculatedTabIndex = tabIndexItems.index[0];
                            } else {
                              changeFocus = false;
                            }
                          }
                        }

                        if (changeFocus === true) {
                          setComponentFocus(false);
                          tabIndexItems[calculatedTabIndex].focus();
                        }
                      }
                      event.preventDefault();
                    }
                  };

                  keyMapper[SPACE_CODE] = function(event) {
                    angular.element(event.target).trigger('click');
                    event.preventDefault();
                  };

                  keyMapper[HOME_CODE] = function(event) {
                    ngVirtualScrollListFocusedElement = getFirstModelTabIndex();
                    moveVirtualViewToItemIndex(0, 'start');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[END_CODE] = function(event) {
                    var itemIndex;

                    ngVirtualScrollListFocusedElement = getLastModelTabIndex();
                    itemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                    moveVirtualViewToItemIndex(itemIndex, 'end');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[UP_ARROW_CODE] = function(event) {
                    var itemIndex;

                    if (tabIndex > getFirstModelTabIndex()) {
                      ngVirtualScrollListFocusedElement = getPrevTabIndex(tabIndex);

                      if ((ngVirtualScrollListFocusedElement < getFirstVirtualTabIndex()) ||
                          (isItemCut(ngVirtualScrollListFocusedElement) < 0)) {
                        itemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                        moveVirtualViewToItemIndex(itemIndex, 'center');
                      } else {
                        focusElement(ngVirtualScrollListFocusedElement);
                      }
                    }
                    event.preventDefault();
                  };

                  keyMapper[PAGE_UP_CODE] = function(event) {
                    var scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                      currentItemIndex,
                      newItemPosition,
                      newItemIndex;

                    currentItemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                    newItemPosition = renderingModel[currentItemIndex].top +
                                      renderingModel[currentItemIndex].height - scrollBoxSize;
                    newItemPosition = (newItemPosition < 0) ? 0 : newItemPosition;
                    newItemIndex = findNodeIndexForPosition(renderingModel, newItemPosition);
                    ngVirtualScrollListFocusedElement = getModelTabIndex(newItemIndex);
                    moveVirtualViewToItemIndex(newItemIndex, 'start');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[DOWN_ARROW_CODE] = function(event) {
                    var itemIndex;

                    if (tabIndex < getLastModelTabIndex()) {
                      ngVirtualScrollListFocusedElement = getNextTabIndex(tabIndex);

                      if ((ngVirtualScrollListFocusedElement > getLastVirtualTabIndex()) ||
                          (isItemCut(ngVirtualScrollListFocusedElement) > 0)) {
                        itemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                        moveVirtualViewToItemIndex(itemIndex, 'center');
                      } else {
                        focusElement(ngVirtualScrollListFocusedElement);
                      }
                    }
                    event.preventDefault();
                  };

                  keyMapper[PAGE_DOWN_CODE] = function(event) {
                    var scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                      currentItemIndex,
                      newItemPosition,
                      newItemIndex;

                    currentItemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                    newItemPosition = renderingModel[currentItemIndex].top + scrollBoxSize;
                    if (newItemPosition > renderingModel.totalHeight) {
                      newItemPosition = renderingModel.totalHeight;
                    }
                    newItemIndex = findNodeIndexForPosition(renderingModel, newItemPosition);
                    ngVirtualScrollListFocusedElement = getModelTabIndex(newItemIndex);
                    moveVirtualViewToItemIndex(newItemIndex, 'start');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  if ((keyMapper[event.keyCode] != null) && (waitForFocusElement === false) &&
                      (keyboardEnable === true)) {
                    keyMapper[event.which](event);
                  }
                  keyboardDelay(keyboardDelayTime);
                };
              }

              function addEventHandlers() {

                function removeEventHandlers() {
                  var eventHandler;

                  while ((eventHandler = ngRepeatEventHandlers.pop()) != null) {
                    eventHandler.element.off("click", eventHandler.click);
                    eventHandler.element.off("focus", eventHandler.focus);
                    eventHandler.element.off("keydown keypress", eventHandler.keypress);
                  }
                }

                $timeout(function() {
                  removeEventHandlers();

                  Object.keys(ngRepeatElements).forEach(function(ngRepeatElementKey) {
                    var ngRepeatElement,
                      tabIndex,
                      eventHandler;

                    if (ngRepeatElements[ngRepeatElementKey] != null) {
                      ngRepeatElement = angular.element(ngRepeatElements[ngRepeatElementKey]);
                      tabIndex = ngRepeatElement.attr('tabindex');

                      if ((tabIndex != null) && (Number(tabIndex) > 0)) {
                        tabIndex = Number(tabIndex);
                        eventHandler = {
                          element: ngRepeatElement,
                          tabIndex: tabIndex,
                          click: ngRepeatElementClickHandler(tabIndex),
                          focus: ngRepeatElementFocusHandler(tabIndex),
                          keypress: ngRepeatElementKeyboardHandler(tabIndex)
                        };

                        ngRepeatElement.on("click", eventHandler.click);
                        ngRepeatElement.on("focus", eventHandler.focus);
                        ngRepeatElement.on("keydown keypress", eventHandler.keypress);
                        ngRepeatEventHandlers.push(eventHandler);
                      }
                    }
                  });
                }, 0);
              }

              function updateVirtualScrollListState(mode) {
                var scrollState;

                function findCompleteDisplayedElement(beginIndex, endIndex, mode) {
                  var index,
                    result;

                  if (mode === 'last') {
                    for (index = endIndex; index >= beginIndex; index -= 1) {
                      if (isItemCutByIndex(index) === 0) {
                        result = index;
                        break;
                      }
                    }
                  } else {
                    for (index = beginIndex; index <= endIndex; index += 1) {
                      if (isItemCutByIndex(index) === 0) {
                        result = index;
                        break;
                      }
                    }
                  }

                  return result;
                }

                function isLastElementVisible(scrollState) {
                  return (scrollState.lastVisibleElementIndex === (renderingModel.length - 1));
                }

                function emitEvents(scrollState) {
                  var eventName;

                  if ((ngVirtualScrollListID != null) && (ngVirtualScrollListID !== '')) {
                    eventName = ngVirtualScrollListID + '-on-change';
                    $scope.$emit(eventName, scrollState);

                    if (isLastElementVisible(scrollState) === true) {
                      eventName = ngVirtualScrollListID + '-on-last';
                      $scope.$emit(eventName, scrollState);
                    }
                  }
                }

                function updateState(scrollState) {
                  var VRI = $scope[virtualRangeIndex],
                    firstVirtualElementIndex,
                    lastVirtualElementIndex;

                  scrollState.timestamp = new Date().getTime();
                  firstVirtualElementIndex = VRI.firstVirtualNodeIndex;
                  lastVirtualElementIndex = VRI.lastVirtualNodeIndex;
                  scrollState.firstVirtualElementIndex = firstVirtualElementIndex;
                  scrollState.firstVisibleElementIndex =
                    findCompleteDisplayedElement(firstVirtualElementIndex, lastVirtualElementIndex,
                                                 'first');
                  scrollState.lastVirtualElementIndex = lastVirtualElementIndex;
                  scrollState.lastVisibleElementIndex =
                    findCompleteDisplayedElement(firstVirtualElementIndex, lastVirtualElementIndex,
                                                 'last');
                  scrollState.invisibleLeadingElementHeight = VRI.invisibleLeadingElementHeight;
                  scrollState.invisibleFollowingElementHeight = VRI.invisibleFollowingElementHeight;
                  scrollState.model = renderingModel;
                  return scrollState;
                }

                function updateStateAfterScroll(scrollState) {
                  var firstVirtualElementIndex,
                    lastVirtualElementIndex,
                    firstVisibleElementIndex,
                    lastVisibleElementIndex;

                  if (scrollState != null) {
                    firstVirtualElementIndex = scrollState.firstVirtualElementIndex;
                    lastVirtualElementIndex = scrollState.lastVirtualElementIndex;
                    firstVisibleElementIndex = findCompleteDisplayedElement(firstVirtualElementIndex,
                                                                            lastVirtualElementIndex,
                                                                            'first');
                    lastVisibleElementIndex = findCompleteDisplayedElement(firstVirtualElementIndex,
                                                                           lastVirtualElementIndex,
                                                                           'last');

                    if ((scrollState.firstVisibleElementIndex !== firstVisibleElementIndex) ||
                        (scrollState.lastVisibleElementIndex !== lastVisibleElementIndex)) {
                      scrollState.firstVisibleElementIndex = firstVisibleElementIndex;
                      scrollState.lastVisibleElementIndex = lastVisibleElementIndex;
                      scrollState.timestamp = new Date().getTime();

                      if ((ngVirtualScrollListState != null) && (ngVirtualScrollListState !== '')) {
                        $scope.$parent[ngVirtualScrollListState] = scrollState;
                      }

                      virtualScrollListState = scrollState;
                      emitEvents(scrollState);
                    }
                  }
                }

                if (allElements.length > 0) {
                  scrollState = virtualScrollListState || Object.create(null);

                  if (mode === 'VirtualRangeIndex') {
                    scrollState = updateState(scrollState);

                    if ((ngVirtualScrollListState != null) && (ngVirtualScrollListState !== '')) {
                      $scope.$parent[ngVirtualScrollListState] = scrollState;
                    }

                    virtualScrollListState = scrollState;
                    emitEvents(scrollState);
                  }

                  if (mode === 'Scroll') {
                    updateStateAfterScroll(scrollState);
                  }
                }
              }

              function calculateItemIndex(tabIndex) {
                return renderingModel.tabIndexMap[tabIndex];
              }

              function moveVirtualViewToItemIndex(itemIndex, position) {
                var calculatedScrollPosition = 0,
                  scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                  maxScrollPosition = renderingModel.totalHeight;

                if ((itemIndex >= 0) && (itemIndex < allElements.length) && (allElements.length > 0)) {

                  calculatedScrollPosition = renderingModel[itemIndex].top;

                  if (position === 'center') {
                    calculatedScrollPosition = calculatedScrollPosition - (scrollBoxSize / 2) +
                                               (renderingModel[itemIndex].height / 2);
                  }
                  if (position === 'end') {
                    calculatedScrollPosition =
                      calculatedScrollPosition + renderingModel[itemIndex].height - scrollBoxSize + 1;
                  }

                  if (calculatedScrollPosition < 0) {
                    calculatedScrollPosition = 0;
                  }
                  if (calculatedScrollPosition > maxScrollPosition) {
                    calculatedScrollPosition = maxScrollPosition;
                  }

                  calculatedScrollPosition = Math.round(calculatedScrollPosition);
                  setContainerScrollPosition($scope.scrollParentContainer, calculatedScrollPosition);
                }
              }

              function focusElement(tabIndex) {
                waitForFocusElement = true;

                $timeout(function() {
                  ngRepeatEventHandlers.some(function(eventHandler) {
                    if (eventHandler.tabIndex === tabIndex) {
                      eventHandler.element[0].focus();
                      return true;
                    }
                    return false;
                  });

                  $timeout(function() {
                    waitForFocusElement = false;
                  }, 15);
                }, 0);
              }

              function isItemCutByIndex(itemIndex) {
                var itemBottomPosition,
                  scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                  startScrollPosition = getContainerScrollPosition($scope.scrollParentContainer),
                  endScrollPosition = startScrollPosition + scrollBoxSize + 1;

                if (renderingModel[itemIndex].top < startScrollPosition) {
                  return -1;
                }
                itemBottomPosition = renderingModel[itemIndex].top + renderingModel[itemIndex].height;
                if (itemBottomPosition > endScrollPosition) {
                  return 1;
                }

                return 0;
              }

              function isItemCut(tabIndex) {
                var itemIndex = calculateItemIndex(tabIndex);
                return isItemCutByIndex(itemIndex);
              }

              function virtualViewReposition(tabIndex) {
                var itemIndex = calculateItemIndex(tabIndex),
                  itemCutStatus;

                if ((ngVirtualScrollListFocusedElement < getFirstVirtualTabIndex()) ||
                    (ngVirtualScrollListFocusedElement > getLastVirtualTabIndex())) {
                  moveVirtualViewToItemIndex(itemIndex, 'center');
                  return true;
                } else {
                  itemCutStatus = isItemCut(tabIndex);
                  if (itemCutStatus < 0) {
                    moveVirtualViewToItemIndex(itemIndex, 'start');
                    return true;
                  }
                  if (itemCutStatus > 0) {
                    moveVirtualViewToItemIndex(itemIndex, 'end');
                    return true;
                  }
                }

                return false;
              }

              function checkVirtualViewNeedReposition(event) {
                var repositionButtons = Object.create(null);

                [LEFT_ARROW_CODE, RIGHT_ARROW_CODE, UP_ARROW_CODE, DOWN_ARROW_CODE, HOME_CODE, END_CODE,
                 PAGE_UP_CODE, PAGE_DOWN_CODE].forEach(function(key) {
                                                         repositionButtons[key] = true;
                                                       });

                if ((ngVirtualScrollListKeyMode === true) && (getComponentFocus() === true) &&
                    (repositionButtons[event.keyCode] === true)) {

                  if (virtualViewReposition(ngVirtualScrollListFocusedElement) === true) {
                    event.preventDefault();
                  }
                }
              }

              function checkComponentLoseFocus(event) {
                var itemTabIndex = Number(angular.element(event.target).attr('tabindex')),
                  firstComponentTabIndex,
                  lastComponentTabIndex;

                if (allElements.length > 0) {
                  firstComponentTabIndex = getFirstModelTabIndex();
                  lastComponentTabIndex = getLastModelTabIndex();

                  if ((itemTabIndex != null) && (firstComponentTabIndex != null) && (lastComponentTabIndex
                                                                                     != null)) {
                    if ((itemTabIndex < firstComponentTabIndex) || (itemTabIndex
                                                                    > lastComponentTabIndex)) {
                      setComponentFocus(false);
                    }
                  } else {
                    setComponentFocus(false);
                  }
                } else {
                  setComponentFocus(false);
                }
              }

              function setFocus() {
                var firstVirtualTabIndex,
                  lastVirtualTabIndex;

                if ((ngVirtualScrollListKeyMode === true) && (getComponentFocus() === true)
                    && (allElements.length > 0)) {
                  firstVirtualTabIndex = getFirstVirtualTabIndex();
                  lastVirtualTabIndex = getLastVirtualTabIndex();

                  if ((ngVirtualScrollListFocusedElement >= firstVirtualTabIndex) &&
                      (ngVirtualScrollListFocusedElement <= lastVirtualTabIndex)) {
                    focusElement(ngVirtualScrollListFocusedElement);
                  }
                }
              }

              function setUpElementsSize() {
                var element,
                  index,
                  modelIndex;

                $timeout(function() {
                  if (ngRepeatElements.length > 2) {
                    for (index = 1; (index < (ngRepeatElements.length - 1)); index += 1) {
                      modelIndex = $scope[virtualRangeIndex].firstVirtualNodeIndex + index - 1;
                      element = angular.element(ngRepeatElements[index]);
                      element.css('height', renderingModel[modelIndex].height + 'px');
                    }
                  }
                }, 0);
              }

              function registerEventListeners() {
                if ((ngVirtualScrollListID != null) && (ngVirtualScrollListID !== '')) {
                  $scope.$on('ngVirtualScrollListTrigger(' + ngVirtualScrollListID + ')',
                             function(event, args) {
                               var itemIndex = args.scrollIndex,
                                 position = args.scrollIndexPosition,
                                 positions = {
                                   top: 'start',
                                   bottom: 'end',
                                   center: 'center'
                                 };

                               if ((itemIndex != null) && (itemIndex >= 0) && (itemIndex
                                                                               < allElements.length)) {
                                 if (positions[position] != null) {
                                   position = positions[position];
                                 } else {
                                   position = positions.top;
                                 }
                                 moveVirtualViewToItemIndex(itemIndex, position);
                               }
                             });
                }
              }

              setComponentFocus(false);

              $scope.scrollParent.on('keydown keypress', function(event) {
                event.preventDefault();
              });

              $scope.scrollParent.on('scroll', function() {
                updateVirtualScrollListState('Scroll');
              });

              $window.document.addEventListener('focus', checkComponentLoseFocus, true);

              $window.addEventListener('keydown', checkVirtualViewNeedReposition, true);

              $scope.$watch(virtualRangeIndex, function() {
                setUpElementsSize();
                if (ngVirtualScrollListKeyMode === true) {
                  addEventHandlers();
                  setFocus();
                }
                updateVirtualScrollListState('VirtualRangeIndex');
              });

              intervalHandler = $interval(function() {
                if ((ngRepeatEventHandlers.length > 0) &&
                    ($scope[subSetElements].length === ngRepeatEventHandlers.length)) {
                  if (ngRepeatEventHandlers[0].tabIndex
                      !== getModelTabIndex($scope[virtualRangeIndex].firstVirtualNodeIndex)) {
                    addEventHandlers();
                  }
                }
              }, 1000);

              registerEventListeners();

              $scope.$on('$destroy', function() {
                $interval.cancel(intervalHandler);
                $window.document.removeEventListener('focus', checkComponentLoseFocus, true);
                $window.removeEventListener('keydown', checkVirtualViewNeedReposition, true);
              });
            }
          };
        }
      };
    });
  });
