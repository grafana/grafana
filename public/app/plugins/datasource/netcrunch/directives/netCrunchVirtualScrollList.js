/***************************************************************
 *
 * Author   : boguslaw.gorczyca
 * Created  : 2015-06-15
 *
 * 2015 Copyright AdRem Software, all rights reserved
 *
 ****************************************************************/

/* global angular, console */

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

      function parseAttribute (attribute) {
        if (attribute != null) {
          return attribute.replace(/(\{\{)|(}})/g, ' ').trim();
        } else {
          return null;
        }
      }

      function getUniqueID (length) {
        var id = String.fromCharCode(Math.floor((Math.random()*25)+65)),
            asciiCode;

        while (id.length < length) {
          asciiCode = Math.floor((Math.random()*42)+48);
          if ((asciiCode < 58) || (asciiCode > 64)) {
            id += String.fromCharCode(asciiCode);
          }
        }
        return id;
      }

      return {
        restrict: 'A',
        scope: true,

        compile: function ($element) {
          var ngVirtualScrollListID = $element.attr('ng-virtual-scroll-list'),
              ngRepeatChild = $element.children().eq(0),
              ngRepeatExpression = ngRepeatChild.attr('ng-repeat'),
              ngRepeatHtmlTemplate = ngRepeatChild[0].outerHTML,
              ngRepeatTabIndex = parseAttribute(ngRepeatChild.attr('tabindex')),
              expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)(track\s+by\s+\S+)?$/.exec(ngRepeatExpression),
              ngRepeatItem = expressionMatches[1],
              ngRepeatStatement = expressionMatches[2],
              ngRepeatTrackBy = expressionMatches[3],
              ngRepeatItemHeight = ngRepeatChild.attr('ng-virtual-scroll-list-element-height'),
              ngVirtualScrollListKeyMode = (ngRepeatTabIndex != null),

              closestElement = angular.element.prototype.closest,
              isHorizontal,
              subSetElements = '$ngVirtualScrollListSubSetElements' + getUniqueID(10),
              virtualRangeIndex = '$ngVirtualScrollListVirtualRangeIndex' + getUniqueID(10),
              allElements = [],
              renderingModel;

          function checkScrollParent(scrollParent) {
            if (scrollParent.length === 0) {
              throw 'Specified scroll parent selector did not match any element';
            }
            return scrollParent;
          }

          function getScrollBoxSize(container) {
            return {
              height : container.clientHeight,
              width : container.clientWidth
            };
          }

          function calculateScrollBoxSize (container) {
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

            YPosition = (YPosition > renderingModel.totalHeight) ?
                         renderingModel.totalHeight : YPosition;
            return binarySearch(renderingModel, YPosition, 0, renderingModel.length - 1);
          }

          $element.empty();

          return {
            pre: function($scope, $element, $attributes) {
              var ngRepeatElement = angular.element(ngRepeatHtmlTemplate),
                  scrollParent = closestElement.call($element,
                                                     $attributes.ngVirtualScrollListParent) || $element,
                  scrollParentContainer,
                  invisibleSpaces = {
                    leadingSpace : null,
                    followingSpace : null
                  };

              function createFillElement(size, horizontal){
                var fillElement = angular.element('<div></div>'),
                    minHeight = (horizontal === true) ? '' : '100%',
                    minWidth = (horizontal === true) ? '100%' : '',
                    height = (horizontal === true) ? size : '',
                    width = (horizontal === true) ? '' : size;

                fillElement.css({
                  'background-color': 'transparent',
                  'border': '0px solid transparent',
                  'cursor': 'default',
                  'margin': '0',
                  'min-height': minHeight,
                  'min-width': minWidth,
                  'height': height,
                  'width': width,
                  'overflow': 'hidden'
                });
                return fillElement;
              }

              function createRenderingModel (elements) {
                var renderingModel = [],
                    currentHeight,
                    currentTop = 0,
                    lastModelIndex;

                function getElementHeight (element) {
                  var elementScope,
                      elementHeight;

                  elementScope = $scope.$new();
                  elementScope[ngRepeatItem] = element;
                  elementHeight = elementScope.$eval(ngRepeatItemHeight);
                  if ((elementHeight == null) || (typeof elementHeight !== 'number')) {
                    elementHeight = 0;
                  }
                  elementScope.$destroy();

                  return elementHeight;
                }

                elements.forEach(function(element) {
                  currentHeight = getElementHeight(element);
                  renderingModel.push({top : currentTop, height : currentHeight});
                  currentTop += currentHeight;
                });

                if (renderingModel.length > 0) {
                  lastModelIndex = renderingModel.length - 1;
                  renderingModel.totalHeight = renderingModel[lastModelIndex].top +
                                               renderingModel[lastModelIndex].height;
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
                  firstVirtualNodeIndex = findNodeIndexForPosition(renderingModel,
                                                                   scrollTopPosition);
                  invisibleLeadingElementHeight = renderingModel[firstVirtualNodeIndex].top;
                }
                if (scrollBottomPosition >= renderingModel.totalHeight) {
                  lastVirtualNodeIndex = renderingModel.length - 1;
                  invisibleFollowingElementHeight = 0;
                } else {
                  lastVirtualNodeIndex = findNodeIndexForPosition(renderingModel,
                                                                  scrollBottomPosition);
                  invisibleFollowingElementHeight = renderingModel.totalHeight -
                      (renderingModel[lastVirtualNodeIndex].top +
                       renderingModel[lastVirtualNodeIndex].height);
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
                  leadingSpace : createFillElement(0, !isHorizontal),
                  followingSpace : createFillElement(0, !isHorizontal)
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
                    };

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
                    if ((currentRI.invisibleLeadingElementHeight !==
                         calculatedRI.invisibleLeadingElementHeight) ||
                        (currentRI.firstVirtualNodeIndex !==
                         calculatedRI.firstVirtualNodeIndex) ||
                        (currentRI.lastVirtualNodeIndex !==
                         calculatedRI.lastVirtualNodeIndex) ||
                        (currentRI.invisibleFollowingElementHeight !==
                         calculatedRI.invisibleFollowingElementHeight)) {

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
                if (updateSubSetElements() === true) {
                  $scope.$apply();
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
                function () {
                  return (isHorizontal === true) ? scrollParentContainer.clientHeight :
                                                   scrollParentContainer.clientWidth;
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

              $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', updateHandler, true);
              });
            },

            post: function($scope, $element) {
              var ngRepeatElements = $element[0].children,
                  ngRepeatEventHandlers = [],
                  ngVirtualScrollListFocusedElement = null,
                  hasComponentFocus = '$ngVirtualScrollListHasComponentFocus' + getUniqueID(10),
                  waitForFocusElement = false,
                  keyboardTimer = false,
                  keyboardEnable = true;

              function keyboardDelay (delay) {
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

              function getModelTabIndex (index) {
                var localScope,
                    tabIndex;

                if ((index >= 0) && (index < allElements.length)) {
                  localScope = $scope.$new(true);
                  localScope[ngRepeatItem] = allElements[index];
                  tabIndex = localScope.$eval(ngRepeatTabIndex);
                  localScope.$destroy();
                  return tabIndex;
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
                return function (currentTabIndex) {
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
                return function (currentTabIndex) {
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

              function ngRepeatElementClickHandler (tabIndex) {
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

              function ngRepeatElementKeyboardHandler (tabIndex) {

                return function(event) {
                  var keyMapper = Object.create(null);

                  keyMapper[TAB_CODE] = function (event) {
                    var tabIndexItems,
                        firstVirtualTabIndex,
                        lastVirtualTabIndex,
                        firstTabIndexPointer,
                        lastTabIndexPointer,
                        calculatedTabIndex,
                        changeFocus = true;

                    function sortTabIndexes (indexTabA, indexTabB) {
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
                              calculatedTabIndex = tabIndexItems.
                                                          index[tabIndexItems.index.length - 1];
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

                  keyMapper[SPACE_CODE] = function (event) {
                    angular.element(event.target).trigger('click');
                    event.preventDefault();
                  };

                  keyMapper[HOME_CODE] = function (event) {
                    ngVirtualScrollListFocusedElement = getFirstModelTabIndex();
                    moveVirtualViewToItemIndex(0, 'start');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[END_CODE] = function (event) {
                    var itemIndex;

                    ngVirtualScrollListFocusedElement = getLastModelTabIndex();
                    itemIndex = calculateItemIndex(ngVirtualScrollListFocusedElement);
                    moveVirtualViewToItemIndex(itemIndex, 'end');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[UP_ARROW_CODE] = function (event) {
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
                    newItemPosition = renderingModel[currentItemIndex].top  +
                                      renderingModel[currentItemIndex].height - scrollBoxSize;
                    newItemPosition = (newItemPosition < 0) ? 0 : newItemPosition;
                    newItemIndex = findNodeIndexForPosition(renderingModel, newItemPosition);
                    ngVirtualScrollListFocusedElement = getModelTabIndex(newItemIndex);
                    moveVirtualViewToItemIndex(newItemIndex, 'start');
                    focusElement(ngVirtualScrollListFocusedElement);
                    event.preventDefault();
                  };

                  keyMapper[DOWN_ARROW_CODE] = function (event) {
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

                  keyMapper[PAGE_DOWN_CODE] = function (event) {
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

              function calculateItemIndex(tabIndex) {
                var itemIndex = null;

                allElements.some(function(item, index) {
                  if (getModelTabIndex(index) === Number(tabIndex)) {
                    itemIndex = index;
                    return true;
                  } else {
                    return false;
                  }
                });

                return itemIndex;
              }

              function moveVirtualViewToItemIndex(itemIndex, position) {
                var calculatedScrollPosition = 0,
                    scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                    maxScrollPosition = renderingModel.totalHeight;

                if ((itemIndex >= 0) && (itemIndex < allElements.length) &&
                    (allElements.length > 0)) {

                  calculatedScrollPosition = renderingModel[itemIndex].top;

                  if (position === 'center') {
                    calculatedScrollPosition = calculatedScrollPosition - (scrollBoxSize / 2) +
                                               (renderingModel[itemIndex].height / 2);
                  }
                  if (position === 'end') {
                    calculatedScrollPosition = calculatedScrollPosition +
                                               renderingModel[itemIndex].height - scrollBoxSize;
                  }

                  if (calculatedScrollPosition < 0) {
                    calculatedScrollPosition = 0;
                  }
                  if (calculatedScrollPosition > maxScrollPosition) {
                    calculatedScrollPosition = maxScrollPosition;
                  }

                  calculatedScrollPosition = Math.round(calculatedScrollPosition);
                  setContainerScrollPosition($scope.scrollParentContainer,
                                                    calculatedScrollPosition);
                }
              }

              function focusElement(tabIndex) {
                waitForFocusElement = true;

                $timeout(function() {
                  ngRepeatEventHandlers.some(function(eventHandler) {
                    if (eventHandler.tabIndex === tabIndex){
                      eventHandler.element[0].focus();
                      return true;
                    }
                    return false;
                  });

                  $timeout(function() { waitForFocusElement = false; }, 15);
                }, 0);
              }

              function isItemCut(tabIndex) {
                var itemIndex = calculateItemIndex(tabIndex),
                    itemBottomPosition,
                    scrollBoxSize = calculateScrollBoxSize($scope.scrollParentContainer),
                    startScrollPosition = getContainerScrollPosition($scope.scrollParentContainer),
                    endScrollPosition = startScrollPosition + scrollBoxSize + 1;

                if (renderingModel[itemIndex].top < startScrollPosition) {
                  return -1;
                }
                itemBottomPosition = renderingModel[itemIndex].top +
                                     renderingModel[itemIndex].height;
                if (itemBottomPosition > endScrollPosition) {
                  return 1;
                }

                return 0;
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

              function checkVirtualViewNeedReposition (event) {
                var repositionButtons = Object.create(null);

                repositionButtons[LEFT_ARROW_CODE] = true;
                repositionButtons[RIGHT_ARROW_CODE] = true;
                repositionButtons[UP_ARROW_CODE] = true;
                repositionButtons[DOWN_ARROW_CODE] = true;
                repositionButtons[HOME_CODE] = true;
                repositionButtons[END_CODE] = true;
                repositionButtons[PAGE_UP_CODE] = true;
                repositionButtons[PAGE_DOWN_CODE] = true;

                if ((ngVirtualScrollListKeyMode === true) && (getComponentFocus() === true) &&
                    (repositionButtons[event.keyCode] === true)) {

                  if (virtualViewReposition(ngVirtualScrollListFocusedElement) === true) {
                    event.preventDefault();
                  }
                }
              }

              function checkComponentLoseFocus (event) {
                var itemTabIndex = Number(angular.element(event.target).attr('tabindex')),
                    firstComponentTabIndex,
                    lastComponentTabIndex;

                if (allElements.length > 0) {
                  firstComponentTabIndex = getFirstModelTabIndex();
                  lastComponentTabIndex = getLastModelTabIndex();

                  if ((itemTabIndex != null) && (firstComponentTabIndex != null) &&
                      (lastComponentTabIndex != null)) {
                    if ((itemTabIndex < firstComponentTabIndex) ||
                        (itemTabIndex > lastComponentTabIndex)) {
                      setComponentFocus(false);
                    }
                  } else {
                    setComponentFocus(false);
                  }
                } else {
                  setComponentFocus(false);
                }
              }

              function setFocus () {
                var firstVirtualTabIndex,
                    lastVirtualTabIndex;

                if ((ngVirtualScrollListKeyMode === true) && (getComponentFocus() === true) &&
                    (allElements.length > 0)) {
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

                $timeout(function () {
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
                if ((ngVirtualScrollListID != null) && (ngVirtualScrollListID !== '')){
                  $scope.$on('ngVirtualScrollListTrigger(' + ngVirtualScrollListID + ')',
                    function(event, args) {
                      var itemIndex = args.scrollIndex,
                          position = args.scrollIndexPosition,
                          positions = {
                            top : 'start',
                            bottom : 'end',
                            center : 'center'
                          };

                      if ((itemIndex != null) && (itemIndex >= 0) &&
                        (itemIndex < allElements.length)) {
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

              $window.document.addEventListener("focus", checkComponentLoseFocus, true);

              $window.addEventListener('keydown', checkVirtualViewNeedReposition, true);

              $scope.$watch(virtualRangeIndex, function() {
                setUpElementsSize();
                if (ngVirtualScrollListKeyMode === true) {
                  addEventHandlers();
                  setFocus();
                }
              });

              $interval(function() {
                if ((ngRepeatEventHandlers.length > 0) &&
                    ($scope[subSetElements].length === ngRepeatEventHandlers.length)) {
                  if (ngRepeatEventHandlers[0].tabIndex !==
                      getModelTabIndex($scope[virtualRangeIndex].firstVirtualNodeIndex)) {
                    addEventHandlers();
                  }
                }
              }, 1000);

              registerEventListeners();
            }
          };
        }
      };
    });
  });
