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

    module.directive('ngTree', function ($compile, $timeout, $window, $document) {

      var maxTreeLevel = 20,
          keyboardDelayTime = 30,
          ngTreeDefaultConfig = {
            1: {
              collapseButtonWidth: 14,
              contentWidth: 150,
              innerDepth: 18,
              paddingRight: 10,
              marginTop: 20,
              marginBottom: 0,
              height: 30
            },
            2: {
              collapseButtonWidth: 11,
              contentWidth: 150,
              innerDepth: 25,
              paddingRight: 10,
              marginTop: 10,
              marginBottom: 0,
              height: 25
            },
            3: {
              collapseButtonWidth: 11,
              contentWidth: 150,
              innerDepth: 40,
              paddingRight: 10,
              marginTop: 0,
              marginBottom: 5,
              height: 20
            },
            4: {
              collapseButtonWidth: 11,
              contentWidth: 150,
              innerDepth: 55,
              paddingRight: 10,
              marginTop: 0,
              marginBottom: 0,
              height: 20
            }
          },

          TAB_CODE = 9,
          SPACE_CODE = 32,
          PAGE_UP_CODE = 33,
          PAGE_DOWN_CODE = 34,
          END_CODE = 35,
          HOME_CODE = 36,
          LEFT_ARROW_CODE = 37,
          UP_ARROW_CODE = 38,
          RIGHT_ARROW_CODE = 39,
          DOWN_ARROW_CODE = 40;

      function prepareTreeConfig (config) {
        var i,
            lastExistLevel = 0,
            deltaInnerDepth = 0,
            configLevelBuffer;

        for (i = 1; i <= maxTreeLevel; i+=1) {
          if (config[i] != null) {
            lastExistLevel = i;
            if (i > 1) {
              deltaInnerDepth = config[i].innerDepth - config[i-1].innerDepth;
            } else {
              deltaInnerDepth = config[i].innerDepth;
            }
          } else {
            configLevelBuffer = angular.copy(config[lastExistLevel]);
            configLevelBuffer.innerDepth = config[lastExistLevel].innerDepth +
                deltaInnerDepth * (i-lastExistLevel);
            config[i] = configLevelBuffer;
          }
        }

        return config;
      }

      function evalAttribute (attributeName, element, scope) {
        var attribute;
        attribute = element.attr(attributeName);
        attribute = scope.$eval(attribute) || null;
        return attribute;
      }

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

        compile: function($element) {

          var ngTree = $element.eq(0),
              ngTreeID = $element.attr('id'),
              ngTreeExpression = ngTree.attr('ng-tree'),
              expressionMatches = /^\s*(\S+)\s+in\s+([\S\s]+?)?$/.exec(ngTreeExpression),
              ngTreeItem = expressionMatches[1],
              ngTreeStatement = expressionMatches[2],
              ngTreeHtmlNodeTemplate = angular.element(ngTree[0].innerHTML.trim().replace(/\r\n|\r|\n/g, '')),
              ngTreeClass = ngTree.attr('ng-tree-class') || 'map-level',
              ngTreeScrollParent = ngTree.attr('ng-tree-scroll-parent'),
              ngTreeInnerLevel = ngTreeHtmlNodeTemplate.attr('ng-tree-inner-level'),
              ngTreeCollapse = ngTreeHtmlNodeTemplate.attr('ng-tree-collapse'),
              ngTreeCollapseMode = (ngTreeCollapse != null),
              ngTreeCollapseFolder = ngTreeHtmlNodeTemplate.attr('ng-tree-collapse-folder'),
              ngTreeCollapseClick = ngTreeHtmlNodeTemplate.attr('ng-tree-collapse-click'),
              ngTreeTabIndex = parseAttribute(ngTreeHtmlNodeTemplate.attr('tabindex')),
              ngTreeKeyboardMode = (ngTreeTabIndex != null),
              ngTreeFocusedNode = null;

          ngTreeHtmlNodeTemplate[0].innerHTML = ngTreeHtmlNodeTemplate[0].innerHTML.trim();
          $element.empty();

          return {
            pre: function ($scope, $element) {
              var allNodeAdapters = [],
                  treeModel = [],
                  treeConfig,
                  invisibleSpaces,
                  scrollParent = angular.element(document.getElementById(ngTreeScrollParent)) || $element,
                  scrollParentContainer,
                  scrollYPosition = 0,
                  virtualRangeIndex = '$ngVirtualTreeVirtualRangeIndex' + getUniqueID(10),
                  virtualSubTreeDOMElements = null,
                  hasComponentFocus = false,
                  waitForFocusElement = false,
                  keyboardTimer = false,
                  keyboardEnable = true;

              function checkScrollParent(scrollParent) {
                if ((scrollParent.length == null) || (scrollParent.length === 0)) {
                  throw 'Specified scroll parent selector did not match any element';
                }

                return scrollParent;
              }

              function getTreeConfig(treeElement, scope) {
                var ngTreeConfig = evalAttribute('ng-tree-config', treeElement, scope);
                if (ngTreeConfig == null) {
                  ngTreeConfig = ngTreeDefaultConfig;
                }
                return prepareTreeConfig(ngTreeConfig);
              }

              function getNodeAdapter (node) {
                var nodeScope,
                    modelIndex;

                nodeScope = $scope.$new();
                nodeScope[ngTreeItem] = node;

                return {
                  scope: nodeScope,

                  getNode: function() {
                    return node;
                  },

                  getInnerLevel: function() {
                    return nodeScope.$eval(ngTreeInnerLevel);
                  },

                  getClassName: function() {
                    return ngTreeClass + '-' + this.getInnerLevel();
                  },

                  getCollapseState: function() {
                    return nodeScope.$eval(ngTreeCollapse);
                  },

                  setCollapseState: function (state) {
                    nodeScope.$eval(ngTreeCollapse + '=' + state);
                  },

                  isFolderElement: function() {
                    return nodeScope.$eval(ngTreeCollapseFolder);
                  },

                  executeCollapseClick: function () {
                    if (ngTreeCollapseClick != null) {
                      nodeScope.$eval(ngTreeCollapseClick);
                    }
                  },

                  getTotalHeight: function() {
                    var nodeConfig = treeConfig[this.getInnerLevel()];
                    return nodeConfig.marginTop + nodeConfig.height + nodeConfig.marginBottom;
                  },

                  getTabIndex: function() {
                    if (ngTreeKeyboardMode === true) {
                      return nodeScope.$eval(ngTreeTabIndex);
                    } else {
                      return null;
                    }
                  },

                  hasTabIndex: function() {
                    var tabIndex = this.getTabIndex();
                    return ((tabIndex != null) && (isNaN(tabIndex) === false));
                  },

                  setModelIndex: function(index) {
                    modelIndex = index;
                  },

                  getModelIndex: function() {
                    return modelIndex;
                  }
                };
              }

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

              function sortTabIndexes (indexTabA, indexTabB) {
                return indexTabA - indexTabB;
              }

              function createNodeAdapters (nodes) {
                var nodeAdapters = [];

                nodes.forEach(function(node) {
                  nodeAdapters.push(getNodeAdapter(node));
                });
                return nodeAdapters;
              }

              function collapseNode (node) {
                var collapseState,
                    nodeAdapter;

                nodeAdapter = getNodeAdapter(node);
                collapseState = nodeAdapter.getCollapseState();

                if (collapseState == null) {
                  nodeAdapter.setCollapseState(true);
                } else {
                  nodeAdapter.setCollapseState(!collapseState);
                }

                updateViewModel();
                nodeAdapter.executeCollapseClick();
              }

              function setCollapseNodeState(nodeAdapter, state) {
                if (ngTreeCollapseMode === true) {
                  if ((nodeAdapter.isFolderElement() === true) &&
                      (nodeAdapter.getCollapseState() !== state)) {
                    collapseNode(nodeAdapter.getNode());
                    nodeAdapter.scope.$apply();
                  }
                }
              }

              function calculateTreeModel(treeNodeAdapters) {
                var treeModel = [],
                    nodeVisible,
                    collapseLevel = null,
                    maxTreeLevel = 1,
                    nodeInnerLevel,
                    nodeTotalHeight,
                    currentTop = 0;

                function calculateTreeWidth (levelCount) {
                  var nodeConfig,
                      levelWidth,
                      maxWidth = 0,
                      i;

                  for (i=1; i<=levelCount; i+=1){
                    nodeConfig = treeConfig[i];
                    levelWidth = nodeConfig.innerDepth + nodeConfig.contentWidth +
                        nodeConfig.paddingRight;
                    if (levelWidth > maxWidth) { maxWidth = levelWidth; }
                  }

                  return maxWidth;
                }

                function prepareTabIndexes() {
                  if (ngTreeKeyboardMode === true) {
                    treeModel.tabIndexes = Object.create(null);
                    treeModel.tabIndexes.index = [];
                  }
                }

                function updateTabIndexes(nodeAdapter) {
                  var tabIndex;

                  if (ngTreeKeyboardMode === true) {
                    if (nodeAdapter.hasTabIndex() === true) {
                      tabIndex = Number(nodeAdapter.getTabIndex());
                      treeModel.tabIndexes[tabIndex] = treeModel.length - 1;
                      treeModel.tabIndexes.index.push(tabIndex);
                    }
                  }
                }

                function orderTabIndexes() {
                  if (ngTreeKeyboardMode === true) {
                    treeModel.tabIndexes.index = treeModel.tabIndexes.index.sort(sortTabIndexes);
                  }
                }

                prepareTabIndexes();
                treeNodeAdapters.forEach(function(nodeAdapter) {
                  nodeVisible = true;

                  if (collapseLevel == null) {
                    if (nodeAdapter.getCollapseState() === true) {
                      collapseLevel = nodeAdapter.getInnerLevel();
                    }
                  } else {
                    if (nodeAdapter.getInnerLevel() <= collapseLevel) {
                      if (nodeAdapter.getCollapseState() === true) {
                        collapseLevel = nodeAdapter.getInnerLevel();
                      } else {
                        collapseLevel = null;
                      }
                    } else {
                      nodeVisible = false;
                    }
                  }

                  if (nodeVisible === true) {
                    nodeInnerLevel = nodeAdapter.getInnerLevel();
                    nodeTotalHeight = nodeAdapter.getTotalHeight();
                    nodeAdapter.setModelIndex(treeModel.length);
                    treeModel.push({
                      height: nodeTotalHeight,
                      top: currentTop,
                      node: nodeAdapter
                    });
                    if (nodeInnerLevel > maxTreeLevel) { maxTreeLevel = nodeInnerLevel; }
                    currentTop += nodeAdapter.getTotalHeight();
                    updateTabIndexes(nodeAdapter);
                  }
                });

                treeModel.totalTreeHeight = currentTop;
                treeModel.totalTreeWidth = calculateTreeWidth(maxTreeLevel);
                orderTabIndexes();
                return treeModel;
              }

              function getModelTabIndex(elementDescriptor) {
                var tabIndex,
                    returnValue = Object.create(null);

                function getPrevNextTabIndex (elementDescriptor){
                  return function (currentTabIndex) {
                    var tabIndexPointer,
                        returnValue = Object.create(null);

                    tabIndexPointer = tabIndex.indexOf(currentTabIndex);

                    if ((tabIndexPointer >= 0) && (tabIndexPointer < tabIndex.length)) {
                      if (tabIndexPointer === 0) {
                        returnValue.prev = getModelTabIndex('first');
                      } else {
                        returnValue.prev = tabIndex[tabIndexPointer - 1];
                      }
                      if (tabIndexPointer === (tabIndex.length-1)) {
                        returnValue.next = getModelTabIndex('last');
                      } else {
                        returnValue.next = tabIndex[tabIndexPointer + 1];
                      }
                    } else {
                      returnValue.prev = null;
                      returnValue.next = null;
                    }

                    return returnValue[elementDescriptor];
                  };
                }

                function getPrevTabIndex (currentTabIndex) {
                  return getPrevNextTabIndex('prev')(currentTabIndex);
                }

                function getNextTabIndex (currentTabIndex) {
                  return getPrevNextTabIndex('next')(currentTabIndex);
                }

                function getNodeIndex (index) {
                  var nodeIndex = treeModel.tabIndexes[index];
                  nodeIndex = (nodeIndex == null) ? null : nodeIndex;
                  return nodeIndex;
                }

                if (treeModel.tabIndexes != null) {
                  tabIndex = treeModel.tabIndexes.index;

                  if (tabIndex.length > 0) {
                    returnValue.first = tabIndex[0];
                    returnValue.last = tabIndex[tabIndex.length - 1];
                    returnValue.prev = getPrevTabIndex;
                    returnValue.next = getNextTabIndex;
                    returnValue.nodeIndex = getNodeIndex;
                    return returnValue[elementDescriptor];
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }
              }

              function getFirstModelTabIndex() {
                return getModelTabIndex('first');
              }

              function getLastModelTabIndex() {
                return getModelTabIndex('last');
              }

              function getPrevTabIndex(currentTabIndex) {
                return getModelTabIndex('prev')(currentTabIndex);
              }

              function getNextTabIndex(currentTabIndex) {
                return getModelTabIndex('next')(currentTabIndex);
              }

              function convertTabToNodeIndex(tabIndex) {
                return getModelTabIndex('nodeIndex')(tabIndex);
              }

              function createFillElement(width, height) {
                var fillElement = angular.element('<div></div>');

                fillElement.css({
                  'background-color': 'transparent',
                  'border': '0px solid transparent',
                  'cursor': 'default',
                  'margin': '0',
                  'min-height': height,
                  'max-height': height,
                  'min-width': width,
                  'max-width': width,
                  'height': height,
                  'width': width,
                  'overflow': 'hidden'
                });

                return fillElement;
              }

              function createInvisibleSpaces() {
                return {
                  leadingSpace : createFillElement(0, 0),
                  followingSpace : createFillElement(0, 0)
                };
              }

              function updateFillElementSize(element, width, height) {
                element.css({
                  'min-height': height,
                  'max-height': height,
                  'min-width': width,
                  'max-width': width,
                  'height': height,
                  'width': width
                });
              }

              function createNodeDOMElement(nodeAdapter, elementWidth) {
                var nodeDOMElement,
                    nodeDOMScope;

                function createCollapseButton (nodeAdapter, collapseFunction) {
                  var buttonIcon,
                      buttonDIV,
                      buttonElement;

                  if (nodeAdapter.getCollapseState() === true) {
                    buttonIcon = 'fa fa-caret-right';
                  } else {
                    buttonIcon = 'fa fa-caret-down';
                  }

                  buttonDIV = '<div class="' + buttonIcon +
                      '" ng-click="' + collapseFunction + '(' + ngTreeItem + ')"></div>';
                  buttonElement = angular.element(buttonDIV);
                  buttonElement.css({
                    width: treeConfig[nodeAdapter.getInnerLevel()].collapseButtonWidth
                  });

                  return buttonElement;
                }

                function setNodeCSSAttributes (nodeElement, nodeAdapter) {
                  var nodeConfig = treeConfig[nodeAdapter.getInnerLevel()],
                      innerDepth = nodeConfig.innerDepth;

                  if ((ngTreeCollapseMode === true) && (nodeAdapter.isFolderElement() === true)) {
                    innerDepth = nodeConfig.innerDepth - nodeConfig.collapseButtonWidth;
                  }

                  nodeElement.css({
                    paddingLeft: innerDepth + 'px',
                    paddingRight: nodeConfig.paddingRight,
                    height: nodeConfig.height + 'px',
                    marginTop: nodeConfig.marginTop + 'px',
                    marginBottom: nodeConfig.marginBottom + 'px',
                    width: elementWidth
                  });
                }

                function nodeElementClickHandler (event) {
                  var elementTabIndex = Number(angular.element(event.target).attr('tabindex'));

                  if ((elementTabIndex != null) && (ngTreeFocusedNode !== elementTabIndex)) {
                    ngTreeFocusedNode = elementTabIndex;
                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                  }

                  hasComponentFocus = true;
                }

                function nodeElementFocusHandler (event) {
                  if ((hasComponentFocus === true) || (ngTreeFocusedNode == null) ||
                      (ngTreeFocusedNode < getFirstModelTabIndex()) ||
                      (ngTreeFocusedNode > getLastVirtualTabIndex())) {
                    ngTreeFocusedNode = Number(angular.element(event.target).attr('tabindex'));
                  } else {
                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                  }

                  hasComponentFocus = true;
                }

                function nodeElementKeyboardHandler (event) {
                  var keyMapper = Object.create(null);

                  keyMapper[TAB_CODE] = function (event) {
                    var firstVirtualTabIndex,
                        lastVirtualTabIndex,
                        firstTabIndexPointer,
                        lastTabIndexPointer,
                        calculatedTabIndex,
                        tabIndexElements,
                        changeFocus = true;

                    function prepareTabIndexElements() {
                      var visibleDOMElements,
                          element,
                          tabIndex,
                          tabIndexElements = Object.create(null);

                      visibleDOMElements = $document.find('*').filter(':visible');
                      tabIndexElements.index = [];

                      Object.keys(visibleDOMElements).forEach(function(key) {
                        if (isNaN(key) === false) {
                          element = angular.element(visibleDOMElements[key]);
                          tabIndex = element.attr('tabindex');

                          if (tabIndex != null) {
                            tabIndex = Number(tabIndex);
                            tabIndexElements.index.push(tabIndex);
                            tabIndexElements[tabIndex] = element;
                          }
                        }
                      });

                      tabIndexElements.index = tabIndexElements.index.sort(sortTabIndexes);
                      return tabIndexElements;
                    }

                    if (treeModel.length > 0) {
                      tabIndexElements = prepareTabIndexElements();
                      if (tabIndexElements.index.length > 0) {
                        firstVirtualTabIndex = getFirstVirtualTabIndex();
                        lastVirtualTabIndex = getLastVirtualTabIndex();
                        firstTabIndexPointer = tabIndexElements.index.indexOf(firstVirtualTabIndex);
                        lastTabIndexPointer = tabIndexElements.index.indexOf(lastVirtualTabIndex);

                        if (event.shiftKey === true) {
                          if (firstTabIndexPointer > 0) {
                            calculatedTabIndex = tabIndexElements.index[firstTabIndexPointer - 1];
                          } else {
                            if (lastTabIndexPointer < tabIndexElements.index.length - 1) {
                              calculatedTabIndex = tabIndexElements.
                                                      index[tabIndexElements.index.length - 1];
                            } else {
                              changeFocus = false;
                            }
                          }
                        } else {
                          if (lastTabIndexPointer < (tabIndexElements.index.length - 1)) {
                            calculatedTabIndex = tabIndexElements.
                                                               index[lastTabIndexPointer + 1];
                          } else {
                            if (firstTabIndexPointer > 0) {
                              calculatedTabIndex = tabIndexElements.index[0];
                            } else {
                              changeFocus = false;
                            }
                          }
                        }

                        if (changeFocus === true) {
                          hasComponentFocus = false;
                          tabIndexElements[calculatedTabIndex].focus();
                        }
                      }
                      event.preventDefault();
                    }
                  };

                  keyMapper[SPACE_CODE] = function (event) {
                    angular.element(event.target).trigger('click');
                    event.preventDefault();
                  };

                  keyMapper[LEFT_ARROW_CODE] = function (event) {
                    setCollapseNodeState(nodeAdapter, true);
                    event.preventDefault();
                  };

                  keyMapper[RIGHT_ARROW_CODE] = function (event) {
                    setCollapseNodeState(nodeAdapter, false);
                    event.preventDefault();
                  };

                  keyMapper[HOME_CODE] = function (event) {
                    var nodeModelIndex,
                        bottomPosition;

                    ngTreeFocusedNode = getFirstModelTabIndex();
                    nodeModelIndex = convertTabToNodeIndex(ngTreeFocusedNode);
                    bottomPosition = treeModel[nodeModelIndex].top + treeModel[nodeModelIndex].height;

                    if (bottomPosition < scrollParent[0].clientHeight) {
                      moveVirtualViewToNodeIndex(0, 'top');
                    } else {
                      moveVirtualViewToNodeIndex(nodeModelIndex, 'top');
                    }

                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                    event.preventDefault();
                  };

                  keyMapper[END_CODE] = function (event) {
                    var nodeModelIndex,
                        bottomPosition;

                    ngTreeFocusedNode = getLastModelTabIndex();
                    nodeModelIndex = convertTabToNodeIndex(ngTreeFocusedNode);
                    bottomPosition = treeModel[nodeModelIndex].top + treeModel[nodeModelIndex].height;

                    if (bottomPosition < scrollParent[0].clientHeight) {
                      moveVirtualViewToNodeIndex(0, 'top');
                    } else {
                      if ((treeModel.totalTreeHeight - treeModel[nodeModelIndex].top) <
                          scrollParent[0].clientHeight) {
                        moveVirtualViewToNodeIndex(treeModel.length - 1, 'bottom');
                      } else {
                        moveVirtualViewToNodeIndex(nodeModelIndex, 'bottom');
                      }
                    }

                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                    event.preventDefault();
                  };

                  keyMapper[UP_ARROW_CODE] = function (event) {
                    var nodeTabIndex = Number(nodeAdapter.getTabIndex()),
                        prevNodeModelIndex,
                        firstVirtualTabIndex,
                        topScrollPosition,
                        topPrevNodePosition;

                    if (nodeTabIndex > getFirstModelTabIndex()) {
                      ngTreeFocusedNode = getPrevTabIndex(nodeTabIndex);
                      prevNodeModelIndex = convertTabToNodeIndex(ngTreeFocusedNode);
                      firstVirtualTabIndex = getFirstVirtualTabIndex();
                      topScrollPosition = scrollParent[0].scrollTop;
                      topPrevNodePosition = treeModel[prevNodeModelIndex].top;

                      if ((nodeTabIndex === firstVirtualTabIndex) ||
                          (topPrevNodePosition < topScrollPosition)) {
                        moveVirtualViewToNodeIndex(prevNodeModelIndex, 'center');
                      } else {
                        focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                      }
                    }
                    event.preventDefault();
                  };

                  keyMapper[PAGE_UP_CODE] = function(event) {
                    var destinationPosition,
                        nodeTabIndex = Number(nodeAdapter.getTabIndex()),
                        nodeModelIndex = convertTabToNodeIndex(nodeTabIndex),
                        firstTabIndex = getFirstModelTabIndex(),
                        nodeFound = false;

                    destinationPosition = treeModel[nodeModelIndex].top -
                                          scrollParent[0].clientHeight;

                    while ((nodeTabIndex > firstTabIndex) && (nodeFound === false)) {
                      nodeTabIndex = getPrevTabIndex(nodeTabIndex);
                      nodeModelIndex = convertTabToNodeIndex(nodeTabIndex);
                      if (treeModel[nodeModelIndex].top <= destinationPosition) {
                        nodeFound = true;
                      }
                    }

                    if ((treeModel[nodeModelIndex].top + treeModel[nodeModelIndex].height) <
                        scrollParent[0].clientHeight) {
                      moveVirtualViewToNodeIndex(0, 'top');
                    } else {
                      moveVirtualViewToNodeIndex(nodeModelIndex, 'top');
                    }

                    ngTreeFocusedNode = nodeTabIndex;
                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                    event.preventDefault();
                  };

                  keyMapper[DOWN_ARROW_CODE] = function (event) {
                    var nodeTabIndex = Number(nodeAdapter.getTabIndex()),
                        nextNodeModelIndex,
                        lastVirtualTabIndex,
                        bottomScrollPosition,
                        bottomNextNodePosition;

                    if (nodeTabIndex < getLastModelTabIndex()) {
                      ngTreeFocusedNode = getNextTabIndex(nodeTabIndex);
                      lastVirtualTabIndex = getLastVirtualTabIndex();
                      nextNodeModelIndex = convertTabToNodeIndex(ngTreeFocusedNode);
                      bottomScrollPosition = scrollParent[0].scrollTop +
                                             scrollParent[0].clientHeight;
                      bottomNextNodePosition = treeModel[nextNodeModelIndex].top +
                                                  treeModel[nextNodeModelIndex].height - 1;

                      if ((nodeTabIndex === lastVirtualTabIndex) ||
                          (bottomNextNodePosition > bottomScrollPosition)){
                        moveVirtualViewToNodeIndex(nextNodeModelIndex, 'center');
                      } else {
                        focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                      }
                    }
                    event.preventDefault();
                  };

                  keyMapper[PAGE_DOWN_CODE] = function (event) {
                    var destinationPosition,
                        nodeTabIndex = Number(nodeAdapter.getTabIndex()),
                        nodeModelIndex = convertTabToNodeIndex(nodeTabIndex),
                        lastTabIndex = getLastModelTabIndex(),
                        nodeFound = false;

                    destinationPosition = treeModel[nodeModelIndex].top +
                                          scrollParent[0].clientHeight;

                    while ((nodeTabIndex < lastTabIndex) && (nodeFound === false)) {
                      nodeTabIndex = getNextTabIndex(nodeTabIndex);
                      nodeModelIndex = convertTabToNodeIndex(nodeTabIndex);

                      if (treeModel[nodeModelIndex].top >= destinationPosition) {
                        nodeFound = true;
                      }
                    }

                    if ((treeModel.totalTreeHeight - treeModel[nodeModelIndex].top) <
                        scrollParent[0].clientHeight) {
                      moveVirtualViewToNodeIndex(treeModel.length - 1, 'bottom');
                    } else {
                      moveVirtualViewToNodeIndex(nodeModelIndex, 'bottom');
                    }

                    ngTreeFocusedNode = nodeTabIndex;
                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                    event.preventDefault();
                  };

                  if ((keyMapper[event.keyCode] != null) && (waitForFocusElement === false) &&
                     (keyboardEnable === true)) {
                    keyMapper[event.which](event);
                  }

                  keyboardDelay(keyboardDelayTime);
                }

                nodeDOMElement = ngTreeHtmlNodeTemplate.clone();

                if (nodeAdapter.hasTabIndex() === false) {
                  nodeDOMElement[0].removeAttribute('tabIndex');
                }

                if (ngTreeCollapseMode === true) {
                  if (nodeAdapter.isFolderElement() === true) {
                    nodeDOMElement.prepend(createCollapseButton(nodeAdapter, 'collapseNode'));
                    nodeAdapter.scope.collapseNode = collapseNode;
                  }
                }

                nodeDOMScope = nodeAdapter.scope.$new();  //Prevent memory leak during $compile
                nodeDOMElement = $compile(nodeDOMElement)(nodeDOMScope);
                nodeDOMElement.addClass(nodeAdapter.getClassName());
                setNodeCSSAttributes(nodeDOMElement, nodeAdapter);

                if ((ngTreeKeyboardMode === true) && (nodeAdapter.hasTabIndex() === true)) {
                  nodeDOMElement.bind("click", nodeElementClickHandler);
                  nodeDOMElement.bind("focus", nodeElementFocusHandler);
                  nodeDOMElement.bind("keydown keypress", nodeElementKeyboardHandler);
                }

                return {
                  nodeDOMElement: nodeDOMElement,
                  nodeDOMScope: nodeDOMScope
                };
              }

              function createDOMTreeElements(treeModel, firstNodeIndex, lastNodeIndex) {
                var i,
                    nodeModel,
                    nodeDOMElement,
                    treeDOMElements = [];
                if (treeModel != null) {
                  for (i=firstNodeIndex; i<=lastNodeIndex; i+=1) {
                    nodeModel = treeModel[i];
                    nodeDOMElement = createNodeDOMElement(nodeModel.node, treeModel.totalTreeWidth);
                    treeDOMElements.push(nodeDOMElement);
                  }
                }

                return treeDOMElements;
              }

              function removeDOMTreeElements (treeDOMElements) {
                if (treeDOMElements != null) {
                  treeDOMElements.forEach(function(element) {
                    element.nodeDOMElement.remove();
                    element.nodeDOMScope.$destroy();
                  });
                }
              }

              function insertDOMTreeElements (treeDOMElements, followingDOMElement) {
                var insertedElements = [];

                if (treeDOMElements != null) {
                  treeDOMElements.forEach(function(element) {
                    element.nodeDOMElement.insertBefore(followingDOMElement);
                    insertedElements.push(element);
                  });
                }
                return insertedElements;
              }

              function checkVirtualViewNeedReposition (event) {
                var repositionButtons = Object.create(null);

                repositionButtons[UP_ARROW_CODE] = true;
                repositionButtons[DOWN_ARROW_CODE] = true;
                repositionButtons[HOME_CODE] = true;
                repositionButtons[END_CODE] = true;
                repositionButtons[PAGE_UP_CODE] = true;
                repositionButtons[PAGE_DOWN_CODE] = true;

                if ((ngTreeKeyboardMode === true) && (hasComponentFocus === true) &&
                    (repositionButtons[event.keyCode] === true)) {
                  if ((ngTreeFocusedNode < getFirstVirtualTabIndex()) ||
                      (ngTreeFocusedNode > getLastVirtualTabIndex())) {
                    moveVirtualViewToNodeIndex(convertTabToNodeIndex(ngTreeFocusedNode), 'center');
                    event.preventDefault();
                  }
                }
              }

              function moveVirtualViewToNodeIndex(nodeIndex, position) {
                var calculatedScrollPosition,
                    parentHeight = scrollParent[0].clientHeight,
                    nodeHeight,
                    maxScrollPosition = treeModel.totalTreeHeight - parentHeight;

                if (treeModel.length > 0) {
                  if ((nodeIndex >= 0) && (nodeIndex < treeModel.length) &&
                      (treeModel[nodeIndex] != null)) {
                    calculatedScrollPosition = treeModel[nodeIndex].top;
                    nodeHeight = treeModel[nodeIndex].height;

                    if (position === 'center') {
                      calculatedScrollPosition = calculatedScrollPosition - (parentHeight / 2) +
                                                 (nodeHeight / 2);
                    }
                    if (position === 'bottom') {
                      calculatedScrollPosition = calculatedScrollPosition + nodeHeight -
                                                   parentHeight;
                    }
                    if (calculatedScrollPosition < 0) {
                      calculatedScrollPosition = 0;
                    }
                    if (calculatedScrollPosition > maxScrollPosition) {
                      calculatedScrollPosition = maxScrollPosition;
                    }

                    calculatedScrollPosition = Math.round(calculatedScrollPosition);
                    scrollParent[0].scrollTop = calculatedScrollPosition;
                  }
                }
              }

              function checkComponentLoseFocus (event) {
                var elementTabIndex = Number(angular.element(event.target).attr('tabindex')),
                    firstComponentTabIndex,
                    lastComponentTabIndex;

                if (treeModel.length > 0) {
                  firstComponentTabIndex = getFirstModelTabIndex();
                  lastComponentTabIndex = getLastModelTabIndex();

                  if ((elementTabIndex != null) && (firstComponentTabIndex != null) &&
                      (lastComponentTabIndex != null)) {
                    if ((elementTabIndex < firstComponentTabIndex) ||
                        (elementTabIndex > lastComponentTabIndex)) {
                      hasComponentFocus = false;
                    }
                  } else {
                    hasComponentFocus = false;
                  }
                } else {
                  hasComponentFocus = false;
                }
              }

              function focusElement(treeDOMElements, tabIndex) {
                waitForFocusElement = true;
                $timeout(function() {
                  treeDOMElements.some(function(element) {
                    element = element.nodeDOMElement;
                    if (Number(element.attr('tabindex')) === tabIndex){
                      element[0].focus();
                      return true;
                    }
                    return false;
                  });
                  $timeout(function() { waitForFocusElement = false; }, 15);
                }, 0);
              }

              function drawVirtualView () {
                var leadingElementHeight = $scope[virtualRangeIndex].invisibleLeadingElementHeight,
                    followingElementHeight = $scope[virtualRangeIndex].invisibleFollowingElementHeight,
                    invisibleElementWidth = $scope[virtualRangeIndex].invisibleElementsWidth,
                    firstVirtualNodeIndex = $scope[virtualRangeIndex].firstVirtualNodeIndex,
                    lastVirtualNodeIndex = $scope[virtualRangeIndex].lastVirtualNodeIndex,
                    firstTabIndex,
                    lastTabIndex;

                updateFillElementSize(invisibleSpaces.leadingSpace, invisibleElementWidth,
                                      leadingElementHeight);
                removeDOMTreeElements(virtualSubTreeDOMElements);
                virtualSubTreeDOMElements = createDOMTreeElements(treeModel, firstVirtualNodeIndex, lastVirtualNodeIndex);
                virtualSubTreeDOMElements = insertDOMTreeElements(virtualSubTreeDOMElements,
                                                                  invisibleSpaces.followingSpace);
                updateFillElementSize(invisibleSpaces.followingSpace, invisibleElementWidth,
                                      followingElementHeight);
                if ((ngTreeKeyboardMode === true) && (hasComponentFocus === true) &&
                    (treeModel.length > 0)) {
                  firstTabIndex = getFirstVirtualTabIndex();
                  lastTabIndex = getLastVirtualTabIndex();
                  if ((ngTreeFocusedNode >= firstTabIndex) && (ngTreeFocusedNode <= lastTabIndex)) {
                    focusElement(virtualSubTreeDOMElements, ngTreeFocusedNode);
                  }
                }
              }

              function calculateVisibleRangeIndex (container, treeModel) {
                var topPosition = Math.round(container.scrollTop),
                    bottomPosition = topPosition + container.clientHeight,
                    firstVirtualNodeIndex,
                    lastVirtualNodeIndex,
                    invisibleLeadingElementHeight,
                    invisibleFollowingElementHeight,
                    totalTreeHeight = treeModel.totalTreeHeight;

                function findNodeIndexForPosition(treeModel, YPosition) {

                  function binarySearch(treeModel, value, indexStart, indexEnd) {
                    var midIndex = indexStart + Math.floor((indexEnd - indexStart) / 2),
                        nodeModel = treeModel[midIndex],
                        nodeTop = nodeModel.top,
                        nodeBottom = nodeTop + nodeModel.node.getTotalHeight();

                    if ((nodeTop <= value) && (value <= nodeBottom)) {
                      return midIndex;
                    } else {
                      if (value < nodeTop) {
                        return binarySearch(treeModel, value, indexStart, midIndex - 1);
                      }
                      if (value > nodeBottom) {
                        return binarySearch(treeModel, value, midIndex + 1, indexEnd);
                      }
                    }
                  }

                  YPosition = (YPosition > totalTreeHeight) ? totalTreeHeight : YPosition;
                  return binarySearch(treeModel, YPosition, 0, treeModel.length - 1);
                }

                if (topPosition === 0) {
                  firstVirtualNodeIndex = 0;
                  invisibleLeadingElementHeight = 0;
                } else {
                  firstVirtualNodeIndex = findNodeIndexForPosition(treeModel, topPosition);
                  invisibleLeadingElementHeight = treeModel[firstVirtualNodeIndex].top;
                }
                if (bottomPosition >= treeModel.totalTreeHeight) {
                  lastVirtualNodeIndex = treeModel.length-1;
                  invisibleFollowingElementHeight = 0;
                } else {
                  lastVirtualNodeIndex = findNodeIndexForPosition(treeModel, bottomPosition);
                  invisibleFollowingElementHeight = treeModel.totalTreeHeight -
                      (treeModel[lastVirtualNodeIndex].top +
                      treeModel[lastVirtualNodeIndex].node.getTotalHeight());
                }

                return {
                  invisibleLeadingElementHeight: invisibleLeadingElementHeight,
                  invisibleElementsWidth: treeModel.totalTreeWidth,
                  firstVirtualNodeIndex: firstVirtualNodeIndex,
                  lastVirtualNodeIndex: lastVirtualNodeIndex,
                  invisibleFollowingElementHeight: invisibleFollowingElementHeight
                };
              }

              function updateVirtualRangeIndex() {
                var calculatedRangeIndex = calculateVisibleRangeIndex(scrollParentContainer, treeModel),
                    currentRangeIndex = $scope[virtualRangeIndex],
                    calculatedRI = calculatedRangeIndex,
                    currentRI = currentRangeIndex;

                if (currentRangeIndex == null) {
                  $scope[virtualRangeIndex] = calculatedRangeIndex;
                  return true;
                } else {
                  if ((currentRI.invisibleLeadingElementHeight !==
                      calculatedRI.invisibleLeadingElementHeight) ||
                      (currentRI.invisibleElementsWidth !== calculatedRI.invisibleElementsWidth) ||
                      (currentRI.firstVirtualNodeIndex !== calculatedRI.firstVirtualNodeIndex) ||
                      (currentRI.lastVirtualNodeIndex !== calculatedRI.lastVirtualNodeIndex) ||
                      (currentRI.invisibleFollowingElementHeight !==
                      calculatedRI.invisibleFollowingElementHeight)) {

                    $scope[virtualRangeIndex] = calculatedRI;
                    return true;
                  } else {
                    return false;
                  }
                }
              }

              function getVirtualTabIndex(elementDescription) {
                var firstVirtualNodeIndex = $scope[virtualRangeIndex].firstVirtualNodeIndex,
                    lastVirtualNodeIndex = $scope[virtualRangeIndex].lastVirtualNodeIndex,
                    i,
                    resultValue = Object.create(null);

                resultValue.first = function() {
                  var firstVirtualTabIndex = null;

                  i = firstVirtualNodeIndex;
                  while ((i <= lastVirtualNodeIndex) && (firstVirtualTabIndex === null)){
                    if (treeModel[i].node.hasTabIndex() === true) {
                      firstVirtualTabIndex = treeModel[i].node.getTabIndex();
                    }
                    i =+ 1;
                  }

                  return firstVirtualTabIndex;
                };

                resultValue.last = function() {
                  var lastVirtualTabIndex = null;

                  i = lastVirtualNodeIndex;
                  while ((i >= firstVirtualNodeIndex) && (lastVirtualTabIndex === null)){
                    if (treeModel[i].node.hasTabIndex() === true) {
                      lastVirtualTabIndex = treeModel[i].node.getTabIndex();
                    }
                    i =- 1;
                  }

                  return lastVirtualTabIndex;
                };

                return resultValue[elementDescription]();
              }

              function getFirstVirtualTabIndex() {
                return getVirtualTabIndex('first');
              }

              function getLastVirtualTabIndex() {
                return getVirtualTabIndex('last');
              }

              function updateViewModel() {
                treeModel = calculateTreeModel(allNodeAdapters);
                $scope[virtualRangeIndex] = null;
                updateVirtualRangeIndex();
              }

              function updateHandler() {
                if (updateVirtualRangeIndex() === true) {
                  $scope.$apply();
                }
              }

              function registerEventListeners() {
                if ((ngTreeID != null) && (ngTreeID !== '')){
                  $scope.$on('ngTreeRedraw(' + ngTreeID + ')', function() {
                    updateHandler();
                  });
                }
              }

              scrollParent = checkScrollParent(scrollParent);
              scrollParentContainer = scrollParent[0];
              treeConfig = getTreeConfig(ngTree, $scope);

              invisibleSpaces = createInvisibleSpaces();
              $element.append(invisibleSpaces.leadingSpace);
              $element.append(invisibleSpaces.followingSpace);

              $scope.$watchCollection(ngTreeStatement, function(changedTree) {
                var allNodes = changedTree || [];
                allNodeAdapters = createNodeAdapters(allNodes);
                updateViewModel();
              });

              scrollParent.on('scroll', function() {

                function updateHandlerAfterFocusElement() {
                  if (waitForFocusElement === false) {
                    if (scrollYPosition !== Math.round(scrollParentContainer.scrollTop)) {
                      scrollYPosition = Math.round(scrollParentContainer.scrollTop);
                      updateHandler();
                    }
                  } else {
                    $timeout(updateHandlerAfterFocusElement, 0);
                  }
                }

                updateHandlerAfterFocusElement();
              });

              scrollParent.on('keydown keypress', function(event) {
                event.preventDefault();
              });

              $scope.$watch(virtualRangeIndex, function() {
                drawVirtualView();
              });

              $window.document.addEventListener("focus", checkComponentLoseFocus, true);

              $window.addEventListener('keydown', checkVirtualViewNeedReposition, true);

              $window.addEventListener('resize', updateHandler, true);

              $scope.$on('$destroy', function() {
                $window.removeEventListener('resize', updateHandler, true);
              });

              registerEventListeners();
            }
          };
        }
      };
    });
  });
