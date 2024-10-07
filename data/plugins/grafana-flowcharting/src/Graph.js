/**
 * Copyright (c) 2006-2012, JGraph Ltd
 */
// Workaround for allowing target="_blank" in HTML sanitizer
// see https://code.google.com/p/google-caja/issues/detail?can=2&q=&colspec=ID%20Type%20Status%20Priority%20Owner%20Summary&groupby=&sort=&id=1296

module.exports = function (urlParams) {
	if (typeof html4 !== 'undefined') {
		html4.ATTRIBS["a::target"] = 0;
		html4.ATTRIBS["source::src"] = 0;
		html4.ATTRIBS["video::src"] = 0;
		// Would be nice for tooltips but probably a security risk...
		//html4.ATTRIBS["video::autoplay"] = 0;
		//html4.ATTRIBS["video::autobuffer"] = 0;
	}

	/**
	 * Sets global constants.
	 */
	// Changes default colors
	mxConstants.SHADOW_OPACITY = 0.25;
	mxConstants.SHADOWCOLOR = '#000000';
	mxConstants.VML_SHADOWCOLOR = '#d0d0d0';
	mxGraph.prototype.pageBreakColor = '#c0c0c0';
	mxGraph.prototype.pageScale = 1;

	// Letter page format is default in US, Canada and Mexico
	(function () {
		try {
			if (navigator != null && navigator.language != null) {
				var lang = navigator.language.toLowerCase();
				mxGraph.prototype.pageFormat = (lang === 'en-us' || lang === 'en-ca' || lang === 'es-mx') ?
					mxConstants.PAGE_FORMAT_LETTER_PORTRAIT : mxConstants.PAGE_FORMAT_A4_PORTRAIT;
			}
		}
		catch (e) {
			// ignore
		}
	})();

	// Matches label positions of mxGraph 1.x
	mxText.prototype.baseSpacingTop = 5;
	mxText.prototype.baseSpacingBottom = 1;

	// Keeps edges between relative child cells inside parent
	mxGraphModel.prototype.ignoreRelativeEdgeParent = false;

	// Defines grid properties
	mxGraphView.prototype.gridImage = (mxClient.IS_SVG) ? 'data:image/gif;base64,R0lGODlhCgAKAJEAAAAAAP///8zMzP///yH5BAEAAAMALAAAAAAKAAoAAAIJ1I6py+0Po2wFADs=' :
		IMAGE_PATH + '/grid.gif';
	mxGraphView.prototype.gridSteps = 4;
	mxGraphView.prototype.minGridSize = 4;

	// UrlParams is null in embed mode
	mxGraphView.prototype.gridColor = '#e0e0e0';

	// Alternative text for unsupported foreignObjects
	mxSvgCanvas2D.prototype.foAltText = '[Not supported by viewer]';

	// Hook for custom constraints
	mxShape.prototype.getConstraints = function (style) {
		return null;
	};

	/**
	 * Constructs a new graph instance. Note that the constructor does not take a
	 * container because the graph instance is needed for creating the UI, which
	 * in turn will create the container for the graph. Hence, the container is
	 * assigned later in EditorUi.
	 */
	/**
	 * Defines graph class.
	 */
	var Graph = function (container, model, renderHint, stylesheet, themes) {
		mxGraph.call(this, container, model, renderHint, stylesheet);

		this.themes = themes || this.defaultThemes;
		this.currentEdgeStyle = mxUtils.clone(this.defaultEdgeStyle);
		this.currentVertexStyle = mxUtils.clone(this.defaultVertexStyle);

		// Sets the base domain URL and domain path URL for relative links.
		var b = this.baseUrl;
		var p = b.indexOf('//');
		this.domainUrl = '';
		this.domainPathUrl = '';

		if (p > 0) {
			var d = b.indexOf('/', p + 2);

			if (d > 0) {
				this.domainUrl = b.substring(0, d);
			}

			d = b.lastIndexOf('/');

			if (d > 0) {
				this.domainPathUrl = b.substring(0, d + 1);
			}
		}

		// Adds support for HTML labels via style. Note: Currently, only the Java
		// backend supports HTML labels but CSS support is limited to the following:
		// http://docs.oracle.com/javase/6/docs/api/index.html?javax/swing/text/html/CSS.html
		// TODO: Wrap should not affect isHtmlLabel output (should be handled later)
		this.isHtmlLabel = function (cell) {
			var state = this.view.getState(cell);
			var style = (state != null) ? state.style : this.getCellStyle(cell);

			return style['html'] == '1' || style[mxConstants.STYLE_WHITE_SPACE] == 'wrap';
		};

		// Implements a listener for hover and click handling on edges
		if (this.edgeMode) {
			var start = {
				point: null,
				event: null,
				state: null,
				handle: null,
				selected: false
			};

			// Uses this event to process mouseDown to check the selection state before it is changed
			this.addListener(mxEvent.FIRE_MOUSE_EVENT, mxUtils.bind(this, function (sender, evt) {
				if (evt.getProperty('eventName') == 'mouseDown' && this.isEnabled()) {
					var me = evt.getProperty('event');

					if (!mxEvent.isControlDown(me.getEvent()) && !mxEvent.isShiftDown(me.getEvent())) {
						var state = me.getState();

						if (state != null) {
							// Checks if state was removed in call to stopEditing above
							if (this.model.isEdge(state.cell)) {
								start.point = new mxPoint(me.getGraphX(), me.getGraphY());
								start.selected = this.isCellSelected(state.cell);
								start.state = state;
								start.event = me;

								if (state.text != null && state.text.boundingBox != null &&
									mxUtils.contains(state.text.boundingBox, me.getGraphX(), me.getGraphY())) {
									start.handle = mxEvent.LABEL_HANDLE;
								}
								else {
									var handler = this.selectionCellsHandler.getHandler(state.cell);

									if (handler != null && handler.bends != null && handler.bends.length > 0) {
										start.handle = handler.getHandleForEvent(me);
									}
								}
							}
						}
					}
				}
			}));

			var mouseDown = null;

			this.addMouseListener(
				{
					mouseDown: function (sender, me) { },
					mouseMove: mxUtils.bind(this, function (sender, me) {
						// Checks if any other handler is active
						var handlerMap = this.selectionCellsHandler.handlers.map;
						for (var key in handlerMap) {
							if (handlerMap[key].index != null) {
								return;
							}
						}

						if (this.isEnabled() && !this.panningHandler.isActive() && !mxEvent.isControlDown(me.getEvent()) &&
							!mxEvent.isShiftDown(me.getEvent()) && !mxEvent.isAltDown(me.getEvent())) {
							var tol = this.tolerance;

							if (start.point != null && start.state != null && start.event != null) {
								var state = start.state;

								if (Math.abs(start.point.x - me.getGraphX()) > tol ||
									Math.abs(start.point.y - me.getGraphY()) > tol) {
									// Lazy selection for edges inside groups
									if (!this.isCellSelected(state.cell)) {
										this.setSelectionCell(state.cell);
									}

									var handler = this.selectionCellsHandler.getHandler(state.cell);

									if (handler != null && handler.bends != null && handler.bends.length > 0) {
										var handle = handler.getHandleForEvent(start.event);
										var edgeStyle = this.view.getEdgeStyle(state);
										var entity = edgeStyle == mxEdgeStyle.EntityRelation;

										// Handles special case where label was clicked on unselected edge in which
										// case the label will be moved regardless of the handle that is returned
										if (!start.selected && start.handle == mxEvent.LABEL_HANDLE) {
											handle = start.handle;
										}

										if (!entity || handle == 0 || handle == handler.bends.length - 1 || handle == mxEvent.LABEL_HANDLE) {
											// Source or target handle or connected for direct handle access or orthogonal line
											// with just two points where the central handle is moved regardless of mouse position
											if (handle == mxEvent.LABEL_HANDLE || handle == 0 || state.visibleSourceState != null ||
												handle == handler.bends.length - 1 || state.visibleTargetState != null) {
												if (!entity && handle != mxEvent.LABEL_HANDLE) {
													var pts = state.absolutePoints;

													// Default case where handles are at corner points handles
													// drag of corner as drag of existing point
													if (pts != null && ((edgeStyle == null && handle == null) ||
														edgeStyle == mxEdgeStyle.OrthConnector)) {
														// Does not use handles if they were not initially visible
														handle = start.handle;

														if (handle == null) {
															var box = new mxRectangle(start.point.x, start.point.y);
															box.grow(mxEdgeHandler.prototype.handleImage.width / 2);

															if (mxUtils.contains(box, pts[0].x, pts[0].y)) {
																// Moves source terminal handle
																handle = 0;
															}
															else if (mxUtils.contains(box, pts[pts.length - 1].x, pts[pts.length - 1].y)) {
																// Moves target terminal handle
																handle = handler.bends.length - 1;
															}
															else {
																// Checks if edge has no bends
																var nobends = edgeStyle != null && (pts.length == 2 || (pts.length == 3 &&
																	((Math.round(pts[0].x - pts[1].x) == 0 && Math.round(pts[1].x - pts[2].x) == 0) ||
																		(Math.round(pts[0].y - pts[1].y) == 0 && Math.round(pts[1].y - pts[2].y) == 0))));

																if (nobends) {
																	// Moves central handle for straight orthogonal edges
																	handle = 2;
																}
																else {
																	// Finds and moves vertical or horizontal segment
																	handle = mxUtils.findNearestSegment(state, start.point.x, start.point.y);

																	// Converts segment to virtual handle index
																	if (edgeStyle == null) {
																		handle = mxEvent.VIRTUAL_HANDLE - handle;
																	}
																	// Maps segment to handle
																	else {
																		handle += 1;
																	}
																}
															}
														}
													}

													// Creates a new waypoint and starts moving it
													if (handle == null) {
														handle = mxEvent.VIRTUAL_HANDLE;
													}
												}

												handler.start(me.getGraphX(), me.getGraphX(), handle);
												start.state = null;
												start.event = null;
												start.point = null;
												start.handle = null;
												start.selected = false;
												me.consume();

												// Removes preview rectangle in graph handler
												this.graphHandler.reset();
											}
										}
										else if (entity && (state.visibleSourceState != null || state.visibleTargetState != null)) {
											// Disables moves on entity to make it consistent
											this.graphHandler.reset();
											me.consume();
										}
									}
								}
							}
							else {
								// Updates cursor for unselected edges under the mouse
								var state = me.getState();

								if (state != null) {
									// Checks if state was removed in call to stopEditing above
									if (this.model.isEdge(state.cell)) {
										var cursor = null;
										var pts = state.absolutePoints;

										if (pts != null) {
											var box = new mxRectangle(me.getGraphX(), me.getGraphY());
											box.grow(mxEdgeHandler.prototype.handleImage.width / 2);

											if (state.text != null && state.text.boundingBox != null &&
												mxUtils.contains(state.text.boundingBox, me.getGraphX(), me.getGraphY())) {
												cursor = 'move';
											}
											else if (mxUtils.contains(box, pts[0].x, pts[0].y) ||
												mxUtils.contains(box, pts[pts.length - 1].x, pts[pts.length - 1].y)) {
												cursor = 'pointer';
											}
											else if (state.visibleSourceState != null || state.visibleTargetState != null) {
												// Moving is not allowed for entity relation but still indicate hover state
												var tmp = this.view.getEdgeStyle(state);
												cursor = 'crosshair';

												if (tmp != mxEdgeStyle.EntityRelation && this.isOrthogonal(state)) {
													var idx = mxUtils.findNearestSegment(state, me.getGraphX(), me.getGraphY());

													if (idx < pts.length - 1 && idx >= 0) {
														cursor = (Math.round(pts[idx].x - pts[idx + 1].x) == 0) ?
															'col-resize' : 'row-resize';
													}
												}
											}
										}

										if (cursor != null) {
											state.setCursor(cursor);
										}
									}
								}
							}
						}
					}),
					mouseUp: mxUtils.bind(this, function (sender, me) {
						start.state = null;
						start.event = null;
						start.point = null;
						start.handle = null;
					})
				});
		}

		// HTML entities are displayed as plain text in wrapped plain text labels
		this.cellRenderer.getLabelValue = function (state) {
			var result = mxCellRenderer.prototype.getLabelValue.apply(this, arguments);

			if (state.view.graph.isHtmlLabel(state.cell)) {
				if (state.style['html'] != 1) {
					result = mxUtils.htmlEntities(result, false);
				}
				else {
					result = state.view.graph.sanitizeHtml(result);
				}
			}

			return result;
		};

		// All code below not available and not needed in embed mode
		if (typeof mxVertexHandler !== 'undefined') {
			this.setConnectable(true);
			this.setDropEnabled(true);
			this.setPanning(true);
			this.setTooltips(true);
			this.setAllowLoops(true);
			this.allowAutoPanning = true;
			this.resetEdgesOnConnect = false;
			this.constrainChildren = false;
			this.constrainRelativeChildren = true;

			// Do not scroll after moving cells
			this.graphHandler.scrollOnMove = false;
			this.graphHandler.scaleGrid = true;

			// Disables cloning of connection sources by default
			this.connectionHandler.setCreateTarget(false);
			this.connectionHandler.insertBeforeSource = true;

			// Disables built-in connection starts
			this.connectionHandler.isValidSource = function (cell, me) {
				return false;
			};

			// Sets the style to be used when an elbow edge is double clicked
			this.alternateEdgeStyle = 'vertical';
			if (stylesheet == null) {
				this.loadStylesheet();
			}

			// Adds page centers to the guides for moving cells
			var graphHandlerGetGuideStates = this.graphHandler.getGuideStates;
			this.graphHandler.getGuideStates = function () {
				var result = graphHandlerGetGuideStates.apply(this, arguments);

				// Create virtual cell state for page centers
				if (this.graph.pageVisible) {
					var guides = [];

					var pf = this.graph.pageFormat;
					var ps = this.graph.pageScale;
					var pw = pf.width * ps;
					var ph = pf.height * ps;
					var t = this.graph.view.translate;
					var s = this.graph.view.scale;

					var layout = this.graph.getPageLayout();

					for (var i = 0; i < layout.width; i++) {
						guides.push(new mxRectangle(((layout.x + i) * pw + t.x) * s,
							(layout.y * ph + t.y) * s, pw * s, ph * s));
					}

					for (var j = 0; j < layout.height; j++) {
						guides.push(new mxRectangle((layout.x * pw + t.x) * s,
							((layout.y + j) * ph + t.y) * s, pw * s, ph * s));
					}

					// Page center guides have predence over normal guides
					result = guides.concat(result);
				}

				return result;
			};

			// Overrides zIndex for dragElement
			mxDragSource.prototype.dragElementZIndex = mxPopupMenu.prototype.zIndex;

			// Overrides color for virtual guides for page centers
			mxGuide.prototype.getGuideColor = function (state, horizontal) {
				return (state.cell == null) ? '#ffa500' /* orange */ : mxConstants.GUIDE_COLOR;
			};

			// Changes color of move preview for black backgrounds
			this.graphHandler.createPreviewShape = function (bounds) {
				this.previewColor = (this.graph.background == '#000000') ? '#ffffff' : mxGraphHandler.prototype.previewColor;

				return mxGraphHandler.prototype.createPreviewShape.apply(this, arguments);
			};

			// Handles parts of cells by checking if part=1 is in the style and returning the parent
			// if the parent is not already in the list of cells. container style is used to disable
			// step into swimlanes and dropTarget style is used to disable acting as a drop target.
			// LATER: Handle recursive parts
			this.graphHandler.getCells = function (initialCell) {
				var cells = mxGraphHandler.prototype.getCells.apply(this, arguments);
				var newCells = [];

				for (var i = 0; i < cells.length; i++) {
					var state = this.graph.view.getState(cells[i]);
					var style = (state != null) ? state.style : this.graph.getCellStyle(cells[i]);

					if (mxUtils.getValue(style, 'part', '0') == '1') {
						var parent = this.graph.model.getParent(cells[i]);

						if (this.graph.model.isVertex(parent) && mxUtils.indexOf(cells, parent) < 0) {
							newCells.push(parent);
						}
					}
					else {
						newCells.push(cells[i]);
					}
				}

				return newCells;
			};

			// Handles parts of cells when cloning the source for new connections
			this.connectionHandler.createTargetVertex = function (evt, source) {
				var state = this.graph.view.getState(source);
				var style = (state != null) ? state.style : this.graph.getCellStyle(source);

				if (mxUtils.getValue(style, 'part', false)) {
					var parent = this.graph.model.getParent(source);

					if (this.graph.model.isVertex(parent)) {
						source = parent;
					}
				}

				return mxConnectionHandler.prototype.createTargetVertex.apply(this, arguments);
			};

			var rubberband = new mxRubberband(this);

			this.getRubberband = function () {
				return rubberband;
			};

			// Timer-based activation of outline connect in connection handler
			var startTime = new Date().getTime();
			var timeOnTarget = 0;

			var connectionHandlerMouseMove = this.connectionHandler.mouseMove;

			this.connectionHandler.mouseMove = function () {
				var prev = this.currentState;
				connectionHandlerMouseMove.apply(this, arguments);

				if (prev != this.currentState) {
					startTime = new Date().getTime();
					timeOnTarget = 0;
				}
				else {
					timeOnTarget = new Date().getTime() - startTime;
				}
			};

			// Activates outline connect after 1500ms with touch event or if alt is pressed inside the shape
			// outlineConnect=0 is a custom style that means do not connect to strokes inside the shape,
			// or in other words, connect to the shape's perimeter if the highlight is under the mouse
			// (the name is because the highlight, including all strokes, is called outline in the code)
			var connectionHandleIsOutlineConnectEvent = this.connectionHandler.isOutlineConnectEvent;

			this.connectionHandler.isOutlineConnectEvent = function (me) {
				return (this.currentState != null && me.getState() == this.currentState && timeOnTarget > 2000) ||
					((this.currentState == null || mxUtils.getValue(this.currentState.style, 'outlineConnect', '1') != '0') &&
						connectionHandleIsOutlineConnectEvent.apply(this, arguments));
			};

			// Adds shift+click to toggle selection state
			var isToggleEvent = this.isToggleEvent;
			this.isToggleEvent = function (evt) {
				return isToggleEvent.apply(this, arguments) || mxEvent.isShiftDown(evt);
			};

			// Workaround for Firefox where first mouse down is received
			// after tap and hold if scrollbars are visible, which means
			// start rubberband immediately if no cell is under mouse.
			var isForceRubberBandEvent = rubberband.isForceRubberbandEvent;
			rubberband.isForceRubberbandEvent = function (me) {
				return isForceRubberBandEvent.apply(this, arguments) ||
					(mxUtils.hasScrollbars(this.graph.container) && mxClient.IS_FF &&
						mxClient.IS_WIN && me.getState() == null && mxEvent.isTouchEvent(me.getEvent()));
			};

			// Shows hand cursor while panning
			var prevCursor = null;

			this.panningHandler.addListener(mxEvent.PAN_START, mxUtils.bind(this, function () {
				if (this.isEnabled()) {
					prevCursor = this.container.style.cursor;
					this.container.style.cursor = 'move';
				}
			}));

			this.panningHandler.addListener(mxEvent.PAN_END, mxUtils.bind(this, function () {
				if (this.isEnabled()) {
					this.container.style.cursor = prevCursor;
				}
			}));

			this.popupMenuHandler.autoExpand = true;

			this.popupMenuHandler.isSelectOnPopup = function (me) {
				return mxEvent.isMouseEvent(me.getEvent());
			};

			// Handles links if graph is read-only or cell is locked
			var click = this.click;
			this.click = function (me) {
				var locked = me.state == null && me.sourceState != null && this.isCellLocked(me.sourceState.cell);

				if ((!this.isEnabled() || locked) && !me.isConsumed()) {
					var cell = (locked) ? me.sourceState.cell : me.getCell();

					if (cell != null) {
						var link = this.getLinkForCell(cell);

						if (link != null) {
							if (this.isCustomLink(link)) {
								this.customLinkClicked(link);
							}
							else {
								this.openLink(link);
							}
						}
					}
				}
				else {
					return click.apply(this, arguments);
				}
			};

			// Redirects tooltips for locked cells
			this.tooltipHandler.getStateForEvent = function (me) {
				return me.sourceState;
			};

			// Redirects cursor for locked cells
			var getCursorForMouseEvent = this.getCursorForMouseEvent;
			this.getCursorForMouseEvent = function (me) {
				var locked = me.state == null && me.sourceState != null && this.isCellLocked(me.sourceState.cell);

				return this.getCursorForCell((locked) ? me.sourceState.cell : me.getCell());
			};

			// Shows pointer cursor for clickable cells with links
			// ie. if the graph is disabled and cells cannot be selected
			var getCursorForCell = this.getCursorForCell;
			this.getCursorForCell = function (cell) {
				if (!this.isEnabled() || this.isCellLocked(cell)) {
					var link = this.getLinkForCell(cell);

					if (link != null) {
						return 'pointer';
					}
					else if (this.isCellLocked(cell)) {
						return 'default';
					}
				}

				return getCursorForCell.apply(this, arguments);
			};

			// Changes rubberband selection to be recursive
			this.selectRegion = function (rect, evt) {
				var cells = this.getAllCells(rect.x, rect.y, rect.width, rect.height);
				this.selectCellsForEvent(cells, evt);

				return cells;
			};

			// Recursive implementation for rubberband selection
			this.getAllCells = function (x, y, width, height, parent, result) {
				result = (result != null) ? result : [];

				if (width > 0 || height > 0) {
					var model = this.getModel();
					var right = x + width;
					var bottom = y + height;

					if (parent == null) {
						parent = this.getCurrentRoot();

						if (parent == null) {
							parent = model.getRoot();
						}
					}

					if (parent != null) {
						var childCount = model.getChildCount(parent);

						for (var i = 0; i < childCount; i++) {
							var cell = model.getChildAt(parent, i);
							var state = this.view.getState(cell);

							if (state != null && this.isCellVisible(cell) && mxUtils.getValue(state.style, 'locked', '0') != '1') {
								var deg = mxUtils.getValue(state.style, mxConstants.STYLE_ROTATION) || 0;
								var box = state;

								if (deg != 0) {
									box = mxUtils.getBoundingBox(box, deg);
								}

								if ((model.isEdge(cell) || model.isVertex(cell)) &&
									box.x >= x && box.y + box.height <= bottom &&
									box.y >= y && box.x + box.width <= right) {
									result.push(cell);
								}

								this.getAllCells(x, y, width, height, cell, result);
							}
						}
					}
				}

				return result;
			};

			// Never removes cells from parents that are being moved
			var graphHandlerShouldRemoveCellsFromParent = this.graphHandler.shouldRemoveCellsFromParent;
			this.graphHandler.shouldRemoveCellsFromParent = function (parent, cells, evt) {
				if (this.graph.isCellSelected(parent)) {
					return false;
				}

				return graphHandlerShouldRemoveCellsFromParent.apply(this, arguments);
			};

			// Unlocks all cells
			this.isCellLocked = function (cell) {
				var pState = this.view.getState(cell);

				while (pState != null) {
					if (mxUtils.getValue(pState.style, 'locked', '0') == '1') {
						return true;
					}

					pState = this.view.getState(this.model.getParent(pState.cell));
				}

				return false;
			};

			var tapAndHoldSelection = null;

			// Uses this event to process mouseDown to check the selection state before it is changed
			this.addListener(mxEvent.FIRE_MOUSE_EVENT, mxUtils.bind(this, function (sender, evt) {
				if (evt.getProperty('eventName') == 'mouseDown') {
					var me = evt.getProperty('event');
					var state = me.getState();

					if (state != null && !this.isSelectionEmpty() && !this.isCellSelected(state.cell)) {
						tapAndHoldSelection = this.getSelectionCells();
					}
					else {
						tapAndHoldSelection = null;
					}
				}
			}));

			// Tap and hold on background starts rubberband for multiple selected
			// cells the cell associated with the event is deselected
			this.addListener(mxEvent.TAP_AND_HOLD, mxUtils.bind(this, function (sender, evt) {
				if (!mxEvent.isMultiTouchEvent(evt)) {
					var me = evt.getProperty('event');
					var cell = evt.getProperty('cell');

					if (cell == null) {
						var pt = mxUtils.convertPoint(this.container,
							mxEvent.getClientX(me), mxEvent.getClientY(me));
						rubberband.start(pt.x, pt.y);
					}
					else if (tapAndHoldSelection != null) {
						this.addSelectionCells(tapAndHoldSelection);
					}
					else if (this.getSelectionCount() > 1 && this.isCellSelected(cell)) {
						this.removeSelectionCell(cell);
					}

					// Blocks further processing of the event
					tapAndHoldSelection = null;
					evt.consume();
				}
			}));

			// On connect the target is selected and we clone the cell of the preview edge for insert
			this.connectionHandler.selectCells = function (edge, target) {
				this.graph.setSelectionCell(target || edge);
			};

			// Shows connection points only if cell not selected
			this.connectionHandler.constraintHandler.isStateIgnored = function (state, source) {
				return source && state.view.graph.isCellSelected(state.cell);
			};

			// Updates constraint handler if the selection changes
			this.selectionModel.addListener(mxEvent.CHANGE, mxUtils.bind(this, function () {
				var ch = this.connectionHandler.constraintHandler;

				if (ch.currentFocus != null && ch.isStateIgnored(ch.currentFocus, true)) {
					ch.currentFocus = null;
					ch.constraints = null;
					ch.destroyIcons();
				}

				ch.destroyFocusHighlight();
			}));

			// Initializes touch interface
			if (Graph.touchStyle) {
				this.initTouch();
			}

			/**
			 * Adds locking
			 */
			var graphUpdateMouseEvent = this.updateMouseEvent;
			this.updateMouseEvent = function (me) {
				me = graphUpdateMouseEvent.apply(this, arguments);

				if (me.state != null && this.isCellLocked(me.getCell())) {
					me.state = null;
				}

				return me;
			};
		}

		//Create a unique offset object for each graph instance.
		this.currentTranslate = new mxPoint(0, 0);
	};

	/**
	 * Specifies if the touch UI should be used (cannot detect touch in FF so always on for Windows/Linux)
	 */
	Graph.touchStyle = mxClient.IS_TOUCH || (mxClient.IS_FF && mxClient.IS_WIN) || navigator.maxTouchPoints > 0 ||
		navigator.msMaxTouchPoints > 0 || window.urlParams == null || urlParams['touch'] == '1';

	/**
	 * Shortcut for capability check.
	 */
	Graph.fileSupport = window.File != null && window.FileReader != null && window.FileList != null &&
		(window.urlParams == null || urlParams['filesupport'] != '0');

	/**
	 * Default size for line jumps.
	 */
	Graph.lineJumpsEnabled = true;

	/**
	 * Default size for line jumps.
	 */
	Graph.defaultJumpSize = 6;

	/**
	 * Helper function (requires atob).
	 */
	Graph.createSvgImage = function (w, h, data) {
		var tmp = unescape(encodeURIComponent(
			'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' +
			'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + 'px" height="' + h + 'px" ' +
			'version="1.1">' + data + '</svg>'));

		return new mxImage('data:image/svg+xml;base64,' + ((window.btoa) ? btoa(tmp) : Base64.encode(tmp, true)), w, h)
	};

	/**
	 * Graph inherits from mxGraph.
	 */
	mxUtils.extend(Graph, mxGraph);

	/**
	 * Allows all values in fit.
	 */
	Graph.prototype.minFitScale = null;

	/**
	 * Allows all values in fit.
	 */
	Graph.prototype.maxFitScale = null;

	/**
	 * Sets the policy for links. Possible values are "self" to replace any framesets,
	 * "blank" to load the URL in <linkTarget> and "auto" (default).
	 */
	Graph.prototype.linkPolicy = (urlParams['target'] == 'frame') ? 'blank' : (urlParams['target'] || 'auto');

	/**
	 * Target for links that open in a new window. Default is _blank.
	 */
	Graph.prototype.linkTarget = (urlParams['target'] == 'frame') ? '_self' : '_blank';

	/**
	 * Value to the rel attribute of links. Default is 'nofollow noopener noreferrer'.
	 * NOTE: There are security implications when this is changed and if noopener is removed,
	 * then <openLink> must be overridden to allow for the opener to be set by default.
	 */
	Graph.prototype.linkRelation = 'nofollow noopener noreferrer';

	/**
	 * Scrollbars are enabled on non-touch devices (not including Firefox because touch events
	 * cannot be detected in Firefox, see above).
	 */
	Graph.prototype.defaultScrollbars = !mxClient.IS_IOS;

	/**
	 * Specifies if the page should be visible for new files. Default is true.
	 */
	Graph.prototype.defaultPageVisible = true;

	/**
	 * Specifies if the app should run in chromeless mode. Default is false.
	 * This default is only used if the contructor argument is null.
	 */
	Graph.prototype.lightbox = false;

	/**
	 * 
	 */
	Graph.prototype.defaultPageBackgroundColor = '#ffffff';

	/**
	 * 
	 */
	Graph.prototype.defaultPageBorderColor = '#ffffff';

	/**
	 * Specifies the size of the size for "tiles" to be used for a graph with
	 * scrollbars but no visible background page. A good value is large
	 * enough to reduce the number of repaints that is caused for auto-
	 * translation, which depends on this value, and small enough to give
	 * a small empty buffer around the graph. Default is 400x400.
	 */
	Graph.prototype.scrollTileSize = new mxRectangle(0, 0, 400, 400);

	/**
	 * Overrides the background color and paints a transparent background.
	 */
	Graph.prototype.transparentBackground = true;

	/**
	 * Sets the default target for all links in cells.
	 */
	Graph.prototype.defaultEdgeLength = 80;

	/**
	 * Disables move of bends/segments without selecting.
	 */
	Graph.prototype.edgeMode = false;

	/**
	 * Allows all values in fit.
	 */
	Graph.prototype.connectionArrowsEnabled = true;

	/**
	 * Specifies the regular expression for matching placeholders.
	 */
	Graph.prototype.placeholderPattern = new RegExp('%(date\{.*\}|[^%^\{^\}]+)%', 'g');

	/**
	 * Specifies the regular expression for matching placeholders.
	 */
	Graph.prototype.absoluteUrlPattern = new RegExp('^(?:[a-z]+:)?//', 'i');

	/**
	 * Specifies the default name for the theme. Default is 'default'.
	 */
	Graph.prototype.defaultThemeName = 'default';

	/**
	 * Specifies the default name for the theme. Default is 'default'.
	 */
	Graph.prototype.defaultThemes = {};

	/**
	 * Base URL for relative links.
	 */
	Graph.prototype.baseUrl = (urlParams['base'] != null) ?
		decodeURIComponent(urlParams['base']) :
		(((window != window.top) ? document.referrer :
			document.location.toString()).split('#')[0]);

	/**
	 * Specifies if the label should be edited after an insert.
	 */
	Graph.prototype.editAfterInsert = false;

	/**
	 * Defines the built-in properties to be ignored in tooltips.
	 */
	Graph.prototype.builtInProperties = ['label', 'tooltip', 'placeholders', 'placeholder'];

	/**
	 * Installs child layout styles.
	 */
	Graph.prototype.init = function (container) {
		mxGraph.prototype.init.apply(this, arguments);

		// Intercepts links with no target attribute and opens in new window
		this.cellRenderer.initializeLabel = function (state, shape) {
			mxCellRenderer.prototype.initializeLabel.apply(this, arguments);

			// Checks tolerance for clicks on links
			var tol = state.view.graph.tolerance;
			var handleClick = true;
			var first = null;

			var down = mxUtils.bind(this, function (evt) {
				handleClick = true;
				first = new mxPoint(mxEvent.getClientX(evt), mxEvent.getClientY(evt));
			});

			var move = mxUtils.bind(this, function (evt) {
				handleClick = handleClick && first != null &&
					Math.abs(first.x - mxEvent.getClientX(evt)) < tol &&
					Math.abs(first.y - mxEvent.getClientY(evt)) < tol;
			});

			var up = mxUtils.bind(this, function (evt) {
				if (handleClick) {
					var elt = mxEvent.getSource(evt)

					while (elt != null && elt != shape.node) {
						if (elt.nodeName.toLowerCase() == 'a') {
							state.view.graph.labelLinkClicked(state, elt, evt);
							break;
						}

						elt = elt.parentNode;
					}
				}
			});

			mxEvent.addGestureListeners(shape.node, down, move, up);
			mxEvent.addListener(shape.node, 'click', function (evt) {
				mxEvent.consume(evt);
			});
		};

		this.initLayoutManager();
	};

	/**
	 * Implements zoom and offset via CSS transforms. This is currently only used
	 * in read-only as there are fewer issues with the mxCellState not being scaled
	 * and translated.
	 * 
	 * KNOWN ISSUES TO FIX:
	 * - Apply CSS transforms to HTML labels in IE11
	 */
	(function () {
		/**
		 * Uses CSS transforms for scale and translate.
		 */
		Graph.prototype.useCssTransforms = false;

		/**
		 * Contains the scale.
		 */
		Graph.prototype.currentScale = 1;

		/**
		 * Contains the offset.
		 */
		Graph.prototype.currentTranslate = new mxPoint(0, 0);

		/**
		 * Only foreignObject supported for now (no IE11).
		 */
		Graph.prototype.isCssTransformsSupported = function () {
			return this.dialect == mxConstants.DIALECT_SVG && !mxClient.NO_FO;
		};

		/**
		 * Function: getCellAt
		 * 
		 * Needs to modify original method for recursive call.
		 */
		Graph.prototype.getCellAt = function (x, y, parent, vertices, edges, ignoreFn) {
			if (this.useCssTransforms) {
				x = x / this.currentScale - this.currentTranslate.x;
				y = y / this.currentScale - this.currentTranslate.y;
			}

			return this.getScaledCellAt.apply(this, arguments);
		};

		/**
		 * Function: getScaledCellAt
		 * 
		 * Overridden for recursion.
		 */
		Graph.prototype.getScaledCellAt = function (x, y, parent, vertices, edges, ignoreFn) {
			vertices = (vertices != null) ? vertices : true;
			edges = (edges != null) ? edges : true;

			if (parent == null) {
				parent = this.getCurrentRoot();

				if (parent == null) {
					parent = this.getModel().getRoot();
				}
			}

			if (parent != null) {
				var childCount = this.model.getChildCount(parent);

				for (var i = childCount - 1; i >= 0; i--) {
					var cell = this.model.getChildAt(parent, i);
					var result = this.getScaledCellAt(x, y, cell, vertices, edges, ignoreFn);

					if (result != null) {
						return result;
					}
					else if (this.isCellVisible(cell) && (edges && this.model.isEdge(cell) ||
						vertices && this.model.isVertex(cell))) {
						var state = this.view.getState(cell);

						if (state != null && (ignoreFn == null || !ignoreFn(state, x, y)) &&
							this.intersects(state, x, y)) {
							return cell;
						}
					}
				}
			}

			return null;
		};


		/**
		 * Function: repaint
		 * 
		 * Updates the highlight after a change of the model or view.
		 */
		mxCellHighlight.prototype.getStrokeWidth = function (state) {
			var s = this.strokeWidth;

			if (this.graph.useCssTransforms) {
				s /= this.graph.currentScale;
			}

			return s;
		};

		/**
		 * Function: getGraphBounds
		 * 
		 * Overrides getGraphBounds to use bounding box from SVG.
		 */
		mxGraphView.prototype.getGraphBounds = function () {
			var b = this.graphBounds;

			if (this.graph.useCssTransforms) {
				var t = this.graph.currentTranslate;
				var s = this.graph.currentScale;

				b = new mxRectangle(
					(b.x + t.x) * s, (b.y + t.y) * s,
					b.width * s, b.height * s);
			}

			return b;
		};

		/**
		 * Function: viewStateChanged
		 * 
		 * Overrides to bypass full cell tree validation.
		 * TODO: Check if this improves performance
		 */
		mxGraphView.prototype.viewStateChanged = function () {
			if (this.graph.useCssTransforms) {
				this.validate();
				this.graph.sizeDidChange();
			}
			else {
				this.revalidate();
				this.graph.sizeDidChange();
			}
		};

		/**
		 * Function: validate
		 * 
		 * Overrides validate to normalize validation view state and pass
		 * current state to CSS transform.
		 */
		var graphViewValidate = mxGraphView.prototype.validate;

		mxGraphView.prototype.validate = function (cell) {
			if (this.graph.useCssTransforms) {
				this.graph.currentScale = this.scale;
				this.graph.currentTranslate.x = this.translate.x;
				this.graph.currentTranslate.y = this.translate.y;

				this.scale = 1;
				this.translate.x = 0;
				this.translate.y = 0;
			}

			graphViewValidate.apply(this, arguments);

			if (this.graph.useCssTransforms) {
				this.graph.updateCssTransform();

				this.scale = this.graph.currentScale;
				this.translate.x = this.graph.currentTranslate.x;
				this.translate.y = this.graph.currentTranslate.y;
			}
		};

		/**
		 * Function: updateCssTransform
		 * 
		 * Zooms out of the graph by <zoomFactor>.
		 */
		Graph.prototype.updateCssTransform = function () {
			var temp = this.view.getDrawPane();

			if (temp != null) {
				var g = temp.parentNode;

				if (!this.useCssTransforms) {
					g.removeAttribute('transformOrigin');
					g.removeAttribute('transform');
				}
				else {
					var prev = g.getAttribute('transform');
					g.setAttribute('transformOrigin', '0 0');
					g.setAttribute('transform', 'scale(' + this.currentScale + ',' + this.currentScale + ')' +
						'translate(' + this.currentTranslate.x + ',' + this.currentTranslate.y + ')');

					// Applies workarounds only if translate has changed
					if (prev != g.getAttribute('transform')) {
						try {
							// Applies transform to labels outside of the SVG DOM
							// Excluded via isCssTransformsSupported
							//					if (mxClient.NO_FO)
							//					{
							//						var transform = 'scale(' + this.currentScale + ')' + 'translate(' +
							//							this.currentTranslate.x + 'px,' + this.currentTranslate.y + 'px)';
							//							
							//						this.view.states.visit(mxUtils.bind(this, function(cell, state)
							//						{
							//							if (state.text != null && state.text.node != null)
							//							{
							//								// Stores initial CSS transform that is used for the label alignment
							//								if (state.text.originalTransform == null)
							//								{
							//									state.text.originalTransform = state.text.node.style.transform;
							//								}
							//								
							//								state.text.node.style.transform = transform + state.text.originalTransform;
							//							}
							//						}));
							//					}
							// Workaround for https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/4320441/
							if (mxClient.IS_EDGE) {
								// Recommended workaround is to do this on all
								// foreignObjects, but this seems to be faster
								var val = g.style.display;
								g.style.display = 'none';
								g.getBBox();
								g.style.display = val;
							}
						}
						catch (e) {
							// ignore
						}
					}
				}
			}
		};

		var graphViewValidateBackgroundPage = mxGraphView.prototype.validateBackgroundPage;

		mxGraphView.prototype.validateBackgroundPage = function () {
			var useCssTranforms = this.graph.useCssTransforms, scale = this.scale,
				translate = this.translate;

			if (useCssTranforms) {
				this.scale = this.graph.currentScale;
				this.translate = this.graph.currentTranslate;
			}

			graphViewValidateBackgroundPage.apply(this, arguments);

			if (useCssTranforms) {
				this.scale = scale;
				this.translate = translate;
			}
		};

		var graphUpdatePageBreaks = mxGraph.prototype.updatePageBreaks;

		mxGraph.prototype.updatePageBreaks = function (visible, width, height) {
			var useCssTranforms = this.useCssTransforms, scale = this.view.scale,
				translate = this.view.translate;

			if (useCssTranforms) {
				this.view.scale = 1;
				this.view.translate = new mxPoint(0, 0);
				this.useCssTransforms = false;
			}

			graphUpdatePageBreaks.apply(this, arguments);

			if (useCssTranforms) {
				this.view.scale = scale;
				this.view.translate = translate;
				this.useCssTransforms = true;
			}
		};

	})();

	/**
	 * Sets the XML node for the current diagram.
	 */
	Graph.prototype.isLightboxView = function () {
		return this.lightbox;
	};

	/**
	 * Installs automatic layout via styles
	 */
	Graph.prototype.labelLinkClicked = function (state, elt, evt) {
		var href = elt.getAttribute('href');

		if (href != null && !this.isCustomLink(href) && (mxEvent.isLeftMouseButton(evt) &&
			!mxEvent.isPopupTrigger(evt)) || mxEvent.isTouchEvent(evt)) {
			if (!this.isEnabled() || this.isCellLocked(state.cell)) {
				var target = this.isBlankLink(href) ? this.linkTarget : '_top';
				this.openLink(this.getAbsoluteUrl(href), target);
			}

			mxEvent.consume(evt);
		}
	};

	/**
	 * Returns the size of the page format scaled with the page size.
	 */
	Graph.prototype.openLink = function (href, target, allowOpener) {
		var result = window;

		// Workaround for blocking in same iframe
		if (target == '_self' && window != window.top) {
			window.location.href = href;
		}
		else {
			// Avoids page reload for anchors (workaround for IE but used everywhere)
			if (href.substring(0, this.baseUrl.length) == this.baseUrl &&
				href.charAt(this.baseUrl.length) == '#' &&
				target == '_top' && window == window.top) {
				var hash = href.split('#')[1];

				// Forces navigation if on same hash
				if (window.location.hash == '#' + hash) {
					window.location.hash = '';
				}

				window.location.hash = hash;
			}
			else {
				result = window.open(href, target);

				if (result != null && !allowOpener) {
					result.opener = null;
				}
			}
		}

		return result;
	};

	/**
	 * Adds support for page links.
	 */
	Graph.prototype.getLinkTitle = function (href) {
		return href.substring(href.lastIndexOf('/') + 1);
	};

	/**
	 * Adds support for page links.
	 */
	Graph.prototype.isCustomLink = function (href) {
		return href.substring(0, 5) == 'data:';
	};

	/**
	 * Adds support for page links.
	 */
	Graph.prototype.customLinkClicked = function (link) {
		return false;
	};

	/**
	 * Returns true if the fiven href references an external protocol that
	 * should never open in a new window. Default returns true for mailto.
	 */
	Graph.prototype.isExternalProtocol = function (href) {
		return href.substring(0, 7) === 'mailto:';
	};

	/**
	 * Hook for links to open in same window. Default returns true for anchors,
	 * links to same domain or if target == 'self' in the config.
	 */
	Graph.prototype.isBlankLink = function (href) {
		return !this.isExternalProtocol(href) &&
			(this.linkPolicy === 'blank' ||
				(this.linkPolicy !== 'self' &&
					!this.isRelativeUrl(href) &&
					href.substring(0, this.domainUrl.length) !== this.domainUrl));
	};

	/**
	 * 
	 */
	Graph.prototype.isRelativeUrl = function (url) {
		return url != null && !this.absoluteUrlPattern.test(url) &&
			url.substring(0, 5) !== 'data:' &&
			!this.isExternalProtocol(url);
	};

	/**
	 * Installs automatic layout via styles
	 */
	Graph.prototype.initLayoutManager = function () {
		this.layoutManager = new mxLayoutManager(this);

		this.layoutManager.getLayout = function (cell) {
			var state = this.graph.view.getState(cell);
			var style = (state != null) ? state.style : this.graph.getCellStyle(cell);

			if (style != null) {
				if (style['childLayout'] == 'stackLayout') {
					var stackLayout = new mxStackLayout(this.graph, true);
					stackLayout.resizeParentMax = mxUtils.getValue(style, 'resizeParentMax', '1') == '1';
					stackLayout.horizontal = mxUtils.getValue(style, 'horizontalStack', '1') == '1';
					stackLayout.resizeParent = mxUtils.getValue(style, 'resizeParent', '1') == '1';
					stackLayout.resizeLast = mxUtils.getValue(style, 'resizeLast', '0') == '1';
					stackLayout.spacing = style['stackSpacing'] || stackLayout.spacing;
					stackLayout.border = style['stackBorder'] || stackLayout.border;
					stackLayout.marginLeft = style['marginLeft'] || 0;
					stackLayout.marginRight = style['marginRight'] || 0;
					stackLayout.marginTop = style['marginTop'] || 0;
					stackLayout.marginBottom = style['marginBottom'] || 0;
					stackLayout.fill = true;

					return stackLayout;
				}
				else if (style['childLayout'] == 'treeLayout') {
					var treeLayout = new mxCompactTreeLayout(this.graph);
					treeLayout.horizontal = mxUtils.getValue(style, 'horizontalTree', '1') == '1';
					treeLayout.resizeParent = mxUtils.getValue(style, 'resizeParent', '1') == '1';
					treeLayout.groupPadding = mxUtils.getValue(style, 'parentPadding', 20);
					treeLayout.levelDistance = mxUtils.getValue(style, 'treeLevelDistance', 30);
					treeLayout.maintainParentLocation = true;
					treeLayout.edgeRouting = false;
					treeLayout.resetEdges = false;

					return treeLayout;
				}
				else if (style['childLayout'] == 'flowLayout') {
					var flowLayout = new mxHierarchicalLayout(this.graph, mxUtils.getValue(style,
						'flowOrientation', mxConstants.DIRECTION_EAST));
					flowLayout.resizeParent = mxUtils.getValue(style, 'resizeParent', '1') == '1';
					flowLayout.parentBorder = mxUtils.getValue(style, 'parentPadding', 20);
					flowLayout.maintainParentLocation = true;

					// Special undocumented styles for changing the hierarchical
					flowLayout.intraCellSpacing = mxUtils.getValue(style, 'intraCellSpacing', mxHierarchicalLayout.prototype.intraCellSpacing);
					flowLayout.interRankCellSpacing = mxUtils.getValue(style, 'interRankCellSpacing', mxHierarchicalLayout.prototype.interRankCellSpacing);
					flowLayout.interHierarchySpacing = mxUtils.getValue(style, 'interHierarchySpacing', mxHierarchicalLayout.prototype.interHierarchySpacing);
					flowLayout.parallelEdgeSpacing = mxUtils.getValue(style, 'parallelEdgeSpacing', mxHierarchicalLayout.prototype.parallelEdgeSpacing);

					return flowLayout;
				}
			}

			return null;
		};
	};

	/**
	 * Returns the size of the page format scaled with the page size.
	 */
	Graph.prototype.getPageSize = function () {
		return (this.pageVisible) ? new mxRectangle(0, 0, this.pageFormat.width * this.pageScale,
			this.pageFormat.height * this.pageScale) : this.scrollTileSize;
	};

	/**
	 * Returns a rectangle describing the position and count of the
	 * background pages, where x and y are the position of the top,
	 * left page and width and height are the vertical and horizontal
	 * page count.
	 */
	Graph.prototype.getPageLayout = function () {
		var size = this.getPageSize();
		var bounds = this.getGraphBounds();

		if (bounds.width == 0 || bounds.height == 0) {
			return new mxRectangle(0, 0, 1, 1);
		}
		else {
			// Computes untransformed graph bounds
			var x = Math.ceil(bounds.x / this.view.scale - this.view.translate.x);
			var y = Math.ceil(bounds.y / this.view.scale - this.view.translate.y);
			var w = Math.floor(bounds.width / this.view.scale);
			var h = Math.floor(bounds.height / this.view.scale);

			var x0 = Math.floor(x / size.width);
			var y0 = Math.floor(y / size.height);
			var w0 = Math.ceil((x + w) / size.width) - x0;
			var h0 = Math.ceil((y + h) / size.height) - y0;

			return new mxRectangle(x0, y0, w0, h0);
		}
	};

	/**
	 * Sanitizes the given HTML markup.
	 */
	Graph.prototype.sanitizeHtml = function (value, editing) {
		// Uses https://code.google.com/p/google-caja/wiki/JsHtmlSanitizer
		// NOTE: Original minimized sanitizer was modified to support
		// data URIs for images, mailto and special data:-links.
		// LATER: Add MathML to whitelisted tags
		function urlX(link) {
			if (link != null && link.toString().toLowerCase().substring(0, 11) !== 'javascript:') {
				return link;
			}

			return null;
		};
		function idX(id) { return id };

		return html_sanitize(value, urlX, idX);
	};

	/**
	 * Revalidates all cells with placeholders in the current graph model.
	 */
	Graph.prototype.updatePlaceholders = function () {
		var model = this.model;
		var validate = false;

		for (var key in this.model.cells) {
			var cell = this.model.cells[key];

			if (this.isReplacePlaceholders(cell)) {
				this.view.invalidate(cell, false, false);
				validate = true;
			}
		}

		if (validate) {
			this.view.validate();
		}
	};

	/**
	 * Adds support for placeholders in labels.
	 */
	Graph.prototype.isReplacePlaceholders = function (cell) {
		return cell.value != null && typeof (cell.value) == 'object' &&
			cell.value.getAttribute('placeholders') == '1';
	};

	/**
	 * Returns true if the given mouse wheel event should be used for zooming. This
	 * is invoked if no dialogs are showing and returns true with Alt or Control
	 * (except macOS) is pressed.
	 */
	Graph.prototype.isZoomWheelEvent = function (evt) {
		return mxEvent.isAltDown(evt) || (mxEvent.isMetaDown(evt) && mxClient.IS_MAC) ||
			(mxEvent.isControlDown(evt) && !mxClient.IS_MAC);
	};

	/**
	 * Adds Alt+click to select cells behind cells.
	 */
	Graph.prototype.isTransparentClickEvent = function (evt) {
		return mxEvent.isAltDown(evt);
	};

	/**
	 * Adds ctrl+shift+connect to disable connections.
	 */
	Graph.prototype.isIgnoreTerminalEvent = function (evt) {
		return mxEvent.isShiftDown(evt) && mxEvent.isControlDown(evt);
	};

	/**
	 * Adds support for placeholders in labels.
	 */
	Graph.prototype.isSplitTarget = function (target, cells, evt) {
		return !this.model.isEdge(cells[0]) &&
			!mxEvent.isAltDown(evt) && !mxEvent.isShiftDown(evt) &&
			mxGraph.prototype.isSplitTarget.apply(this, arguments);
	};

	/**
	 * Adds support for placeholders in labels.
	 */
	Graph.prototype.getLabel = function (cell) {
		var result = mxGraph.prototype.getLabel.apply(this, arguments);

		if (result != null && this.isReplacePlaceholders(cell) && cell.getAttribute('placeholder') == null) {
			result = this.replacePlaceholders(cell, result);
		}

		return result;
	};

	/**
	 * Adds labelMovable style.
	 */
	Graph.prototype.isLabelMovable = function (cell) {
		var state = this.view.getState(cell);
		var style = (state != null) ? state.style : this.getCellStyle(cell);

		return !this.isCellLocked(cell) &&
			((this.model.isEdge(cell) && this.edgeLabelsMovable) ||
				(this.model.isVertex(cell) && (this.vertexLabelsMovable ||
					mxUtils.getValue(style, 'labelMovable', '0') == '1')));
	};

	/**
	 * Adds event if grid size is changed.
	 */
	Graph.prototype.setGridSize = function (value) {
		this.gridSize = value;
		this.fireEvent(new mxEventObject('gridSizeChanged'));
	};

	/**
	 * Private helper method.
	 */
	Graph.prototype.getGlobalVariable = function (name) {
		var val = null;

		if (name == 'date') {
			val = new Date().toLocaleDateString();
		}
		else if (name == 'time') {
			val = new Date().toLocaleTimeString();
		}
		else if (name == 'timestamp') {
			val = new Date().toLocaleString();
		}
		else if (name.substring(0, 5) == 'date{') {
			var fmt = name.substring(5, name.length - 1);
			val = this.formatDate(new Date(), fmt);
		}

		return val;
	};

	/**
	 * Formats a date, see http://blog.stevenlevithan.com/archives/date-time-format
	 */
	Graph.prototype.formatDate = function (date, mask, utc) {
		// LATER: Cache regexs
		if (this.dateFormatCache == null) {
			this.dateFormatCache = {
				i18n: {
					dayNames: [
						"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
						"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
					],
					monthNames: [
						"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
						"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
					]
				},

				masks: {
					"default": "ddd mmm dd yyyy HH:MM:ss",
					shortDate: "m/d/yy",
					mediumDate: "mmm d, yyyy",
					longDate: "mmmm d, yyyy",
					fullDate: "dddd, mmmm d, yyyy",
					shortTime: "h:MM TT",
					mediumTime: "h:MM:ss TT",
					longTime: "h:MM:ss TT Z",
					isoDate: "yyyy-mm-dd",
					isoTime: "HH:MM:ss",
					isoDateTime: "yyyy-mm-dd'T'HH:MM:ss",
					isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
				}
			};
		}

		var dF = this.dateFormatCache;
		var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
			timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
			timezoneClip = /[^-+\dA-Z]/g,
			pad = function (val, len) {
				val = String(val);
				len = len || 2;
				while (val.length < len) val = "0" + val;
				return val;
			};

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			utc = true;
		}

		var _ = utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d: d,
				dd: pad(d),
				ddd: dF.i18n.dayNames[D],
				dddd: dF.i18n.dayNames[D + 7],
				m: m + 1,
				mm: pad(m + 1),
				mmm: dF.i18n.monthNames[m],
				mmmm: dF.i18n.monthNames[m + 12],
				yy: String(y).slice(2),
				yyyy: y,
				h: H % 12 || 12,
				hh: pad(H % 12 || 12),
				H: H,
				HH: pad(H),
				M: M,
				MM: pad(M),
				s: s,
				ss: pad(s),
				l: pad(L, 3),
				L: pad(L > 99 ? Math.round(L / 10) : L),
				t: H < 12 ? "a" : "p",
				tt: H < 12 ? "am" : "pm",
				T: H < 12 ? "A" : "P",
				TT: H < 12 ? "AM" : "PM",
				Z: utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o: (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S: ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		return mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});
	};

	/**
	 * 
	 */
	Graph.prototype.createLayersDialog = function () {
		var div = document.createElement('div');
		div.style.position = 'absolute';

		var model = this.getModel();
		var childCount = model.getChildCount(model.root);

		for (var i = 0; i < childCount; i++) {
			(mxUtils.bind(this, function (layer) {
				var span = document.createElement('div');
				span.style.overflow = 'hidden';
				span.style.textOverflow = 'ellipsis';
				span.style.padding = '2px';
				span.style.whiteSpace = 'nowrap';

				var cb = document.createElement('input');
				cb.style.display = 'inline-block';
				cb.setAttribute('type', 'checkbox');

				if (model.isVisible(layer)) {
					cb.setAttribute('checked', 'checked');
					cb.defaultChecked = true;
				}

				span.appendChild(cb);

				var title = this.convertValueToString(layer) || (mxResources.get('background') || 'Background');
				span.setAttribute('title', title);
				mxUtils.write(span, title);
				div.appendChild(span);

				mxEvent.addListener(cb, 'click', function () {
					if (cb.getAttribute('checked') != null) {
						cb.removeAttribute('checked');
					}
					else {
						cb.setAttribute('checked', 'checked');
					}

					model.setVisible(layer, cb.checked);
				});
			})(model.getChildAt(model.root, i)));
		}

		return div;
	};

	/**
	 * Private helper method.
	 */
	Graph.prototype.replacePlaceholders = function (cell, str) {
		var result = [];

		if (str != null) {
			var last = 0;

			while (match = this.placeholderPattern.exec(str)) {
				var val = match[0];

				if (val.length > 2 && val != '%label%' && val != '%tooltip%') {
					var tmp = null;

					if (match.index > last && str.charAt(match.index - 1) == '%') {
						tmp = val.substring(1);
					}
					else {
						var name = val.substring(1, val.length - 1);

						// Workaround for invalid char for getting attribute in older versions of IE
						if (name.indexOf('{') < 0) {
							var current = cell;

							while (tmp == null && current != null) {
								if (current.value != null && typeof (current.value) == 'object') {
									tmp = (current.hasAttribute(name)) ? ((current.getAttribute(name) != null) ?
										current.getAttribute(name) : '') : null;
								}

								current = this.model.getParent(current);
							}
						}

						if (tmp == null) {
							tmp = this.getGlobalVariable(name);
						}
					}

					result.push(str.substring(last, match.index) + ((tmp != null) ? tmp : val));
					last = match.index + val.length;
				}
			}

			result.push(str.substring(last));
		}

		return result.join('');
	};

	/**
	 * Resolves the given cells in the model and selects them.
	 */
	Graph.prototype.restoreSelection = function (cells) {
		if (cells != null && cells.length > 0) {
			var temp = [];

			for (var i = 0; i < cells.length; i++) {
				var newCell = this.model.getCell(cells[i].id);

				if (newCell != null) {
					temp.push(newCell);
				}
			}

			this.setSelectionCells(temp);
		}
		else {
			this.clearSelection();
		}
	};

	/**
	 * Selects cells for connect vertex return value.
	 */
	Graph.prototype.selectCellsForConnectVertex = function (cells, evt, hoverIcons) {
		// Selects only target vertex if one exists
		if (cells.length == 2 && this.model.isVertex(cells[1])) {
			this.setSelectionCell(cells[1]);

			if (hoverIcons != null) {
				// Adds hover icons to new target vertex for touch devices
				if (mxEvent.isTouchEvent(evt)) {
					hoverIcons.update(hoverIcons.getState(this.view.getState(cells[1])));
				}
				else {
					// Hides hover icons after click with mouse
					hoverIcons.reset();
				}
			}

			this.scrollCellToVisible(cells[1]);
		}
		else {
			this.setSelectionCells(cells);
		}
	};

	/**
	 * Adds a connection to the given vertex.
	 */
	Graph.prototype.connectVertex = function (source, direction, length, evt, forceClone, ignoreCellAt) {
		ignoreCellAt = (ignoreCellAt) ? ignoreCellAt : false;

		var pt = (source.geometry.relative && source.parent.geometry != null) ?
			new mxPoint(source.parent.geometry.width * source.geometry.x, source.parent.geometry.height * source.geometry.y) :
			new mxPoint(source.geometry.x, source.geometry.y);

		if (direction == mxConstants.DIRECTION_NORTH) {
			pt.x += source.geometry.width / 2;
			pt.y -= length;
		}
		else if (direction == mxConstants.DIRECTION_SOUTH) {
			pt.x += source.geometry.width / 2;
			pt.y += source.geometry.height + length;
		}
		else if (direction == mxConstants.DIRECTION_WEST) {
			pt.x -= length;
			pt.y += source.geometry.height / 2;
		}
		else {
			pt.x += source.geometry.width + length;
			pt.y += source.geometry.height / 2;
		}

		var parentState = this.view.getState(this.model.getParent(source));
		var s = this.view.scale;
		var t = this.view.translate;
		var dx = t.x * s;
		var dy = t.y * s;

		if (this.model.isVertex(parentState.cell)) {
			dx = parentState.x;
			dy = parentState.y;
		}

		// Workaround for relative child cells
		if (this.model.isVertex(source.parent) && source.geometry.relative) {
			pt.x += source.parent.geometry.x;
			pt.y += source.parent.geometry.y;
		}

		// Checks actual end point of edge for target cell
		var target = (ignoreCellAt || (mxEvent.isControlDown(evt) && !forceClone)) ?
			null : this.getCellAt(dx + pt.x * s, dy + pt.y * s);

		if (this.model.isAncestor(target, source)) {
			target = null;
		}

		// Checks if target or ancestor is locked
		var temp = target;

		while (temp != null) {
			if (this.isCellLocked(temp)) {
				target = null;
				break;
			}

			temp = this.model.getParent(temp);
		}

		// Checks if source and target intersect
		if (target != null) {
			var sourceState = this.view.getState(source);
			var targetState = this.view.getState(target);

			if (sourceState != null && targetState != null && mxUtils.intersects(sourceState, targetState)) {
				target = null;
			}
		}

		var duplicate = !mxEvent.isShiftDown(evt) || forceClone;

		if (duplicate) {
			if (direction == mxConstants.DIRECTION_NORTH) {
				pt.y -= source.geometry.height / 2;
			}
			else if (direction == mxConstants.DIRECTION_SOUTH) {
				pt.y += source.geometry.height / 2;
			}
			else if (direction == mxConstants.DIRECTION_WEST) {
				pt.x -= source.geometry.width / 2;
			}
			else {
				pt.x += source.geometry.width / 2;
			}
		}

		// Uses connectable parent vertex if one exists
		if (target != null && !this.isCellConnectable(target)) {
			var parent = this.getModel().getParent(target);

			if (this.getModel().isVertex(parent) && this.isCellConnectable(parent)) {
				target = parent;
			}
		}

		if (target == source || this.model.isEdge(target) || !this.isCellConnectable(target)) {
			target = null;
		}

		var result = [];

		this.model.beginUpdate();
		try {
			var realTarget = target;

			if (realTarget == null && duplicate) {
				// Handles relative children
				var cellToClone = source;
				var geo = this.getCellGeometry(source);

				while (geo != null && geo.relative) {
					cellToClone = this.getModel().getParent(cellToClone);
					geo = this.getCellGeometry(cellToClone);
				}

				// Handle consistuents for cloning
				var state = this.view.getState(cellToClone);
				var style = (state != null) ? state.style : this.getCellStyle(cellToClone);

				if (mxUtils.getValue(style, 'part', false)) {
					var tmpParent = this.model.getParent(cellToClone);

					if (this.model.isVertex(tmpParent)) {
						cellToClone = tmpParent;
					}
				}

				realTarget = this.duplicateCells([cellToClone], false)[0];

				var geo = this.getCellGeometry(realTarget);

				if (geo != null) {
					geo.x = pt.x - geo.width / 2;
					geo.y = pt.y - geo.height / 2;
				}
			}

			// Never connects children in stack layouts
			var layout = null;

			if (this.layoutManager != null) {
				layout = this.layoutManager.getLayout(this.model.getParent(source));
			}

			var edge = ((mxEvent.isControlDown(evt) && duplicate) || (target == null && layout != null && layout.constructor == mxStackLayout)) ? null :
				this.insertEdge(this.model.getParent(source), null, '', source, realTarget, this.createCurrentEdgeStyle());

			// Inserts edge before source
			if (edge != null && this.connectionHandler.insertBeforeSource) {
				var index = null;
				var tmp = source;

				while (tmp.parent != null && tmp.geometry != null &&
					tmp.geometry.relative && tmp.parent != edge.parent) {
					tmp = this.model.getParent(tmp);
				}

				if (tmp != null && tmp.parent != null && tmp.parent == edge.parent) {
					var index = tmp.parent.getIndex(tmp);
					this.model.add(tmp.parent, edge, index);
				}
			}

			// Special case: Click on west icon puts clone before cell
			if (target == null && realTarget != null && layout != null && source.parent != null &&
				layout.constructor == mxStackLayout && direction == mxConstants.DIRECTION_WEST) {
				var index = source.parent.getIndex(source);
				this.model.add(source.parent, realTarget, index);
			}

			if (edge != null) {
				result.push(edge);
			}

			if (target == null && realTarget != null) {
				result.push(realTarget);
			}

			if (realTarget == null && edge != null) {
				edge.geometry.setTerminalPoint(pt, false);
			}

			if (edge != null) {
				this.fireEvent(new mxEventObject('cellsInserted', 'cells', [edge]));
			}
		}
		finally {
			this.model.endUpdate();
		}

		return result;
	};

	/**
	 * Returns all labels in the diagram as a string.
	 */
	Graph.prototype.getIndexableText = function () {
		var tmp = document.createElement('div');
		var labels = [];
		var label = '';

		for (var key in this.model.cells) {
			var cell = this.model.cells[key];

			if (this.model.isVertex(cell) || this.model.isEdge(cell)) {
				if (this.isHtmlLabel(cell)) {
					tmp.innerHTML = this.getLabel(cell);
					label = mxUtils.extractTextWithWhitespace([tmp]);
				}
				else {
					label = this.getLabel(cell);
				}

				label = mxUtils.trim(label.replace(/[\x00-\x1F\x7F-\x9F]|\s+/g, ' '));

				if (label.length > 0) {
					labels.push(label);
				}
			}
		}

		return labels.join(' ');
	};

	/**
	 * Returns the label for the given cell.
	 */
	Graph.prototype.convertValueToString = function (cell) {
		if (cell.value != null && typeof (cell.value) == 'object') {
			if (this.isReplacePlaceholders(cell) && cell.getAttribute('placeholder') != null) {
				var name = cell.getAttribute('placeholder');
				var current = cell;
				var result = null;

				while (result == null && current != null) {
					if (current.value != null && typeof (current.value) == 'object') {
						result = (current.hasAttribute(name)) ? ((current.getAttribute(name) != null) ?
							current.getAttribute(name) : '') : null;
					}

					current = this.model.getParent(current);
				}

				return result || '';
			}
			else {
				return cell.value.getAttribute('label') || '';
			}
		}

		return mxGraph.prototype.convertValueToString.apply(this, arguments);
	};

	/**
	 * Returns the link for the given cell.
	 */
	Graph.prototype.getLinksForState = function (state) {
		if (state != null && state.text != null && state.text.node != null) {
			return state.text.node.getElementsByTagName('a');
		}

		return null;
	};

	/**
	 * Returns the link for the given cell.
	 */
	Graph.prototype.getLinkForCell = function (cell) {
		if (cell.value != null && typeof (cell.value) == 'object') {
			var link = cell.value.getAttribute('link');

			// Removes links with leading javascript: protocol
			// TODO: Check more possible attack vectors
			if (link != null && link.toLowerCase().substring(0, 11) === 'javascript:') {
				link = link.substring(11);
			}

			return link;
		}

		return null;
	};

	/**
	 * Overrides label orientation for collapsed swimlanes inside stack.
	 */
	Graph.prototype.getCellStyle = function (cell) {
		var style = mxGraph.prototype.getCellStyle.apply(this, arguments);

		if (cell != null && this.layoutManager != null) {
			var parent = this.model.getParent(cell);

			if (this.model.isVertex(parent) && this.isCellCollapsed(cell)) {
				var layout = this.layoutManager.getLayout(parent);

				if (layout != null && layout.constructor == mxStackLayout) {
					style[mxConstants.STYLE_HORIZONTAL] = !layout.horizontal;
				}
			}
		}

		return style;
	};

	/**
	 * Disables alternate width persistence for stack layout parents
	 */
	Graph.prototype.updateAlternateBounds = function (cell, geo, willCollapse) {
		if (cell != null && geo != null && this.layoutManager != null && geo.alternateBounds != null) {
			var layout = this.layoutManager.getLayout(this.model.getParent(cell));

			if (layout != null && layout.constructor == mxStackLayout) {
				if (layout.horizontal) {
					geo.alternateBounds.height = 0;
				}
				else {
					geo.alternateBounds.width = 0;
				}
			}
		}

		mxGraph.prototype.updateAlternateBounds.apply(this, arguments);
	};

	/**
	 * Adds Shift+collapse/expand and size management for folding inside stack
	 */
	Graph.prototype.isMoveCellsEvent = function (evt) {
		return mxEvent.isShiftDown(evt);
	};

	/**
	 * Adds Shift+collapse/expand and size management for folding inside stack
	 */
	Graph.prototype.foldCells = function (collapse, recurse, cells, checkFoldable, evt) {
		recurse = (recurse != null) ? recurse : false;

		if (cells == null) {
			cells = this.getFoldableCells(this.getSelectionCells(), collapse);
		}

		if (cells != null) {
			this.model.beginUpdate();

			try {
				mxGraph.prototype.foldCells.apply(this, arguments);

				// Resizes all parent stacks if alt is not pressed
				if (this.layoutManager != null) {
					for (var i = 0; i < cells.length; i++) {
						var state = this.view.getState(cells[i]);
						var geo = this.getCellGeometry(cells[i]);

						if (state != null && geo != null) {
							var dx = Math.round(geo.width - state.width / this.view.scale);
							var dy = Math.round(geo.height - state.height / this.view.scale);

							if (dy != 0 || dx != 0) {
								var parent = this.model.getParent(cells[i]);
								var layout = this.layoutManager.getLayout(parent);

								if (layout == null) {
									// Moves cells to the right and down after collapse/expand
									if (evt != null && this.isMoveCellsEvent(evt)) {
										this.moveSiblings(state, parent, dx, dy);
									}
								}
								else if ((evt == null || !mxEvent.isAltDown(evt)) && layout.constructor == mxStackLayout && !layout.resizeLast) {
									this.resizeParentStacks(parent, layout, dx, dy);
								}
							}
						}
					}
				}
			}
			finally {
				this.model.endUpdate();
			}

			// Selects cells after folding
			if (this.isEnabled()) {
				this.setSelectionCells(cells);
			}
		}
	};

	/**
	 * Overrides label orientation for collapsed swimlanes inside stack.
	 */
	Graph.prototype.moveSiblings = function (state, parent, dx, dy) {
		this.model.beginUpdate();
		try {
			var cells = this.getCellsBeyond(state.x, state.y, parent, true, true);

			for (var i = 0; i < cells.length; i++) {
				if (cells[i] != state.cell) {
					var tmp = this.view.getState(cells[i]);
					var geo = this.getCellGeometry(cells[i]);

					if (tmp != null && geo != null) {
						geo = geo.clone();
						geo.translate(Math.round(dx * Math.max(0, Math.min(1, (tmp.x - state.x) / state.width))),
							Math.round(dy * Math.max(0, Math.min(1, (tmp.y - state.y) / state.height))));
						this.model.setGeometry(cells[i], geo);
					}
				}
			}
		}
		finally {
			this.model.endUpdate();
		}
	};

	/**
	 * Overrides label orientation for collapsed swimlanes inside stack.
	 */
	Graph.prototype.resizeParentStacks = function (parent, layout, dx, dy) {
		if (this.layoutManager != null && layout != null && layout.constructor == mxStackLayout && !layout.resizeLast) {
			this.model.beginUpdate();
			try {
				var dir = layout.horizontal;

				// Bubble resize up for all parent stack layouts with same orientation
				while (parent != null && layout != null && layout.constructor == mxStackLayout &&
					layout.horizontal == dir && !layout.resizeLast) {
					var pgeo = this.getCellGeometry(parent);
					var pstate = this.view.getState(parent);

					if (pstate != null && pgeo != null) {
						pgeo = pgeo.clone();

						if (layout.horizontal) {
							pgeo.width += dx + Math.min(0, pstate.width / this.view.scale - pgeo.width);
						}
						else {
							pgeo.height += dy + Math.min(0, pstate.height / this.view.scale - pgeo.height);
						}

						this.model.setGeometry(parent, pgeo);
					}

					parent = this.model.getParent(parent);
					layout = this.layoutManager.getLayout(parent);
				}
			}
			finally {
				this.model.endUpdate();
			}
		}
	};

	/**
	 * Disables drill-down for non-swimlanes.
	 */
	Graph.prototype.isContainer = function (cell) {
		var state = this.view.getState(cell);
		var style = (state != null) ? state.style : this.getCellStyle(cell);

		if (this.isSwimlane(cell)) {
			return style['container'] != '0';
		}
		else {
			return style['container'] == '1';
		}
	};

	/**
	 * Adds a connectable style.
	 */
	Graph.prototype.isCellConnectable = function (cell) {
		var state = this.view.getState(cell);
		var style = (state != null) ? state.style : this.getCellStyle(cell);

		return (style['connectable'] != null) ? style['connectable'] != '0' :
			mxGraph.prototype.isCellConnectable.apply(this, arguments);
	};

	/**
	 * Function: selectAll
	 * 
	 * Selects all children of the given parent cell or the children of the
	 * default parent if no parent is specified. To select leaf vertices and/or
	 * edges use <selectCells>.
	 * 
	 * Parameters:
	 * 
	 * parent - Optional <mxCell> whose children should be selected.
	 * Default is <defaultParent>.
	 */
	Graph.prototype.selectAll = function (parent) {
		parent = parent || this.getDefaultParent();

		if (!this.isCellLocked(parent)) {
			mxGraph.prototype.selectAll.apply(this, arguments);
		}
	};

	/**
	 * Function: selectCells
	 * 
	 * Selects all vertices and/or edges depending on the given boolean
	 * arguments recursively, starting at the given parent or the default
	 * parent if no parent is specified. Use <selectAll> to select all cells.
	 * For vertices, only cells with no children are selected.
	 * 
	 * Parameters:
	 * 
	 * vertices - Boolean indicating if vertices should be selected.
	 * edges - Boolean indicating if edges should be selected.
	 * parent - Optional <mxCell> that acts as the root of the recursion.
	 * Default is <defaultParent>.
	 */
	Graph.prototype.selectCells = function (vertices, edges, parent) {
		parent = parent || this.getDefaultParent();

		if (!this.isCellLocked(parent)) {
			mxGraph.prototype.selectCells.apply(this, arguments);
		}
	};

	/**
	 * Function: getSwimlaneAt
	 * 
	 * Returns the bottom-most swimlane that intersects the given point (x, y)
	 * in the cell hierarchy that starts at the given parent.
	 * 
	 * Parameters:
	 * 
	 * x - X-coordinate of the location to be checked.
	 * y - Y-coordinate of the location to be checked.
	 * parent - <mxCell> that should be used as the root of the recursion.
	 * Default is <defaultParent>.
	 */
	Graph.prototype.getSwimlaneAt = function (x, y, parent) {
		parent = parent || this.getDefaultParent();

		if (!this.isCellLocked(parent)) {
			return mxGraph.prototype.getSwimlaneAt.apply(this, arguments);
		}

		return null;
	};

	/**
	 * Disables folding for non-swimlanes.
	 */
	Graph.prototype.isCellFoldable = function (cell) {
		var state = this.view.getState(cell);
		var style = (state != null) ? state.style : this.getCellStyle(cell);

		return this.foldingEnabled && !this.isCellLocked(cell) &&
			((this.isContainer(cell) && style['collapsible'] != '0') ||
				(!this.isContainer(cell) && style['collapsible'] == '1'));
	};

	/**
	 * Stops all interactions and clears the selection.
	 */
	Graph.prototype.reset = function () {
		if (this.isEditing()) {
			this.stopEditing(true);
		}

		this.escape();

		if (!this.isSelectionEmpty()) {
			this.clearSelection();
		}
	};

	/**
	 * Overridden to limit zoom to 1% - 16.000%.
	 */
	Graph.prototype.zoom = function (factor, center) {
		factor = Math.max(0.01, Math.min(this.view.scale * factor, 160)) / this.view.scale;

		mxGraph.prototype.zoom.apply(this, arguments);
	};

	/**
	 * Function: zoomIn
	 * 
	 * Zooms into the graph by <zoomFactor>.
	 */
	Graph.prototype.zoomIn = function () {
		// Switches to 1% zoom steps below 15%
		if (this.view.scale < 0.15) {
			this.zoom((this.view.scale + 0.01) / this.view.scale);
		}
		else {
			// Uses to 5% zoom steps for better grid rendering in webkit
			// and to avoid rounding errors for zoom steps
			this.zoom((Math.round(this.view.scale * this.zoomFactor * 20) / 20) / this.view.scale);
		}
	};

	/**
	 * Function: zoomOut
	 * 
	 * Zooms out of the graph by <zoomFactor>.
	 */
	Graph.prototype.zoomOut = function () {
		// Switches to 1% zoom steps below 15%
		if (this.view.scale <= 0.15) {
			this.zoom((this.view.scale - 0.01) / this.view.scale);
		}
		else {
			// Uses to 5% zoom steps for better grid rendering in webkit
			// and to avoid rounding errors for zoom steps
			this.zoom((Math.round(this.view.scale * (1 / this.zoomFactor) * 20) / 20) / this.view.scale);
		}
	};

	/**
	 * Overrides tooltips to show custom tooltip or metadata.
	 */
	Graph.prototype.getTooltipForCell = function (cell) {
		var tip = '';
		if (mxUtils.isNode(cell.value)) {
			var tmp = cell.value.getAttribute('tooltip');

			if (tmp != null) {
				if (tmp != null && this.isReplacePlaceholders(cell)) {
					tmp = this.replacePlaceholders(cell, tmp);
				}

				tip = this.sanitizeHtml(tmp);
			}
			else {
				var ignored = this.builtInProperties;
				var attrs = cell.value.attributes;
				var temp = [];

				// Hides links in edit mode
				if (this.isEnabled()) {
					ignored.push('link');
				}

				for (var i = 0; i < attrs.length; i++) {
					if (mxUtils.indexOf(ignored, attrs[i].nodeName) < 0 && attrs[i].nodeValue.length > 0) {
						temp.push({ name: attrs[i].nodeName, value: attrs[i].nodeValue });
					}
				}

				// Sorts by name
				temp.sort(function (a, b) {
					if (a.name < b.name) {
						return -1;
					}
					else if (a.name > b.name) {
						return 1;
					}
					else {
						return 0;
					}
				});

				for (var i = 0; i < temp.length; i++) {
					if (temp[i].name != 'link' || !this.isCustomLink(temp[i].value)) {
						tip += ((temp[i].name != 'link') ? '<b>' + temp[i].name + ':</b> ' : '') +
							mxUtils.htmlEntities(temp[i].value) + '\n';
					}
				}

				if (tip.length > 0) {
					tip = tip.substring(0, tip.length - 1);

					if (mxClient.IS_SVG) {
						tip = '<div style="max-width:360px;">' + tip + '</div>';
					}
				}
			}
		}
		return tip;
	};

	/**
	 * Turns the given string into an array.
	 */
	Graph.prototype.stringToBytes = function (str) {
		var arr = new Array(str.length);

		for (var i = 0; i < str.length; i++) {
			arr[i] = str.charCodeAt(i);
		}

		return arr;
	};

	/**
	 * Turns the given array into a string.
	 */
	Graph.prototype.bytesToString = function (arr) {
		var result = new Array(arr.length);

		for (var i = 0; i < arr.length; i++) {
			result[i] = String.fromCharCode(arr[i]);
		}

		return result.join('');
	};

	/**
	 * Returns a base64 encoded version of the compressed outer XML of the given node.
	 */
	Graph.prototype.compressNode = function (node) {
		return this.compress(this.zapGremlins(mxUtils.getXml(node)));
	};

	/**
	 * Returns a base64 encoded version of the compressed string.
	 */
	Graph.prototype.compress = function (data) {
		if (data == null || data.length == 0 || typeof (pako) === 'undefined') {
			return data;
		}
		else {
			var tmp = this.bytesToString(pako.deflateRaw(encodeURIComponent(data)));

			return (window.btoa) ? btoa(tmp) : Base64.encode(tmp, true);
		}
	};

	/**
	 * Returns a decompressed version of the base64 encoded string.
	 */
	Graph.prototype.decompress = function (data) {
		if (data == null || data.length == 0 || typeof (pako) === 'undefined') {
			return data;
		}
		else {
			var tmp = (window.atob) ? atob(data) : Base64.decode(data, true);

			return this.zapGremlins(decodeURIComponent(
				this.bytesToString(pako.inflateRaw(tmp))));
		}
	};

	/**
	 * Removes all illegal control characters with ASCII code <32 except TAB, LF
	 * and CR.
	 */
	Graph.prototype.zapGremlins = function (text) {
		var checked = [];

		for (var i = 0; i < text.length; i++) {
			var code = text.charCodeAt(i);

			// Removes all control chars except TAB, LF and CR
			if (code >= 32 || code == 9 || code == 10 || code == 13) {
				checked.push(text.charAt(i));
			}
		}

		return checked.join('');
	};

	/**
	 * Hover icons are used for hover, vertex handler and drag from sidebar.
	 */
	var HoverIcons = function (graph) {
		this.graph = graph;
		this.init();
	};

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.arrowSpacing = 2;

	/**
	 * Delay to switch to another state for overlapping bbox. Default is 500ms.
	 */
	HoverIcons.prototype.updateDelay = 500;

	/**
	 * Delay to switch between states. Default is 140ms.
	 */
	HoverIcons.prototype.activationDelay = 140;

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.currentState = null;

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.activeArrow = null;

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.inactiveOpacity = 15;

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.cssCursor = 'copy';

	/**
	 * Whether to hide arrows that collide with vertices.
	 * LATER: Add keyboard override, touch support.
	 */
	HoverIcons.prototype.checkCollisions = true;

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.arrowFill = '#29b6f2';

	/**
	 * Up arrow.
	 */
	HoverIcons.prototype.triangleUp = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/triangle-up.png', 26, 14) :
		Graph.createSvgImage(18, 28, '<path d="m 6 26 L 12 26 L 12 12 L 18 12 L 9 1 L 1 12 L 6 12 z" ' +
			'stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');

	/**
	 * Right arrow.
	 */
	HoverIcons.prototype.triangleRight = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/triangle-right.png', 14, 26) :
		Graph.createSvgImage(26, 18, '<path d="m 1 6 L 14 6 L 14 1 L 26 9 L 14 18 L 14 12 L 1 12 z" ' +
			'stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');

	/**
	 * Down arrow.
	 */
	HoverIcons.prototype.triangleDown = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/triangle-down.png', 26, 14) :
		Graph.createSvgImage(18, 26, '<path d="m 6 1 L 6 14 L 1 14 L 9 26 L 18 14 L 12 14 L 12 1 z" ' +
			'stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');

	/**
	 * Left arrow.
	 */
	HoverIcons.prototype.triangleLeft = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/triangle-left.png', 14, 26) :
		Graph.createSvgImage(28, 18, '<path d="m 1 9 L 12 1 L 12 6 L 26 6 L 26 12 L 12 12 L 12 18 z" ' +
			'stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');

	/**
	 * Round target.
	 */
	HoverIcons.prototype.roundDrop = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/round-drop.png', 26, 26) :
		Graph.createSvgImage(26, 26, '<circle cx="13" cy="13" r="12" ' +
			'stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '"/>');

	/**
	 * Refresh target.
	 */
	HoverIcons.prototype.refreshTarget = new mxImage((mxClient.IS_SVG) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NDQxNERDRTU1QjY1MTFFNDkzNTRFQTVEMTdGMTdBQjciIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6NDQxNERDRTY1QjY1MTFFNDkzNTRFQTVEMTdGMTdBQjciPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo0NDE0RENFMzVCNjUxMUU0OTM1NEVBNUQxN0YxN0FCNyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo0NDE0RENFNDVCNjUxMUU0OTM1NEVBNUQxN0YxN0FCNyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PsvuX50AAANaSURBVHja7FjRZ1tRGD9ZJ1NCyIQSwrivI4Q8hCpjlFDyFEoYfSp9Ko1QWnmo0If+BSXkIfo0QirTMUpeGo2EPfWllFYjZMLKLDJn53d3biU337m5J223bPbxk5t7v+/c3/2+73znO8fDOWezKM/YjMpz68Lj8ejY+QTeCCwLxOS9qPxtyN+6wAeBTwJ31CCO0cJDjXBGBN4LfIepSwykTUT1bgpuib0SONIgo8KRHOtRiCFcvUcgZeGrHPNBxLIyFPyRgTGz0xLbegJCdmzpElue5KlAIMDX19d5uVzm5+fnfDAYmMA17uEZdOx2Yvb/sHlu2S0xwymn5ufneTab5b1ej08S6EAXNrDd2dnhiUTim21MvMtwQ6yiIrWwsMDPzs64rsBmf3/fvM7n89TYlUnEllSkQqEQv7q64g+Vk5MTVXosORErU0Zer5f0FEIlw2N6MxwO82QyaXql2+2SxDqdjopYWUUsqEp45IldqtWq6UWVh/1+P7+8vCTJ4QMUJSRIEXuneoH96w8PDyeWAnhSJfCqwm6NIlaklFdXV0cGhRcQ2mlJQXK5nMq2YPEZbnteU1U2lUqN/D84OGD9fl+5fgnSrFarsUwmw0qlEru4uBjTicViTk3Cr27HSnxR+Doyz0ZE1CAWiUTusbu7y9rttlZv5fP5WDQavYfIMba4uEipfhF8XtqJoZXx/uH+sC/4vPg7OljZZQbsCmLtYzc3N6zRaJhotVrmfx0xDINtbm6athYUeXpHdbBNaqZUKpWxWXV7e2vex+xaWVnhc3NzjrPUXgexyCt0m67LBV7uJMITjqRE4o8tZeg8FPpFitgapYxiOC0poFgsji1jKNo6BZZckrAGUtJsNk1vqAihCBcKhTE7hNWhqw2qFnGy5UFOUYJVIJ1OjzSE+BCEilon0URavRmBqnbbQ00AXbm+vnZc9O1tj72OnQoc2+cwygRkb2+P1et17ZoEm3g87lRmjgWZ00kbXkNuse6/Bu2wlegIxfb2tuvWGroO4bO2c4bbzUh60mxDXm1sbJhhxkQYnhS4h2fUZoRAWnf7lv8N27f8P7Xhnekjgpk+VKGOoQbsiY+hhhtF3YO7twIJ+ULvUGv+GQ2fQEvWxI/THNx5/p/BaspPAQYAqStgiSQwCDoAAAAASUVORK5CYII=' :
		IMAGE_PATH + '/refresh.png', 38, 38);

	/**
	 * Tolerance for hover icon clicks.
	 */
	HoverIcons.prototype.tolerance = (mxClient.IS_TOUCH) ? 6 : 0;

	/**
	 * 
	 */
	HoverIcons.prototype.init = function () {
		this.arrowUp = this.createArrow(this.triangleUp, mxResources.get('plusTooltip'));
		this.arrowRight = this.createArrow(this.triangleRight, mxResources.get('plusTooltip'));
		this.arrowDown = this.createArrow(this.triangleDown, mxResources.get('plusTooltip'));
		this.arrowLeft = this.createArrow(this.triangleLeft, mxResources.get('plusTooltip'));

		this.elts = [this.arrowUp, this.arrowRight, this.arrowDown, this.arrowLeft];

		this.repaintHandler = mxUtils.bind(this, function () {
			this.repaint();
		});

		this.graph.selectionModel.addListener(mxEvent.CHANGE, this.repaintHandler);
		this.graph.model.addListener(mxEvent.CHANGE, this.repaintHandler);
		this.graph.view.addListener(mxEvent.SCALE_AND_TRANSLATE, this.repaintHandler);
		this.graph.view.addListener(mxEvent.TRANSLATE, this.repaintHandler);
		this.graph.view.addListener(mxEvent.SCALE, this.repaintHandler);
		this.graph.view.addListener(mxEvent.DOWN, this.repaintHandler);
		this.graph.view.addListener(mxEvent.UP, this.repaintHandler);
		this.graph.addListener(mxEvent.ROOT, this.repaintHandler);

		// Resets the mouse point on escape
		this.graph.addListener(mxEvent.ESCAPE, mxUtils.bind(this, function () {
			this.mouseDownPoint = null;
		}));

		// Removes hover icons if mouse leaves the container
		mxEvent.addListener(this.graph.container, 'mouseleave', mxUtils.bind(this, function (evt) {
			// Workaround for IE11 firing mouseleave for touch in diagram
			if (evt.relatedTarget != null && mxEvent.getSource(evt) == this.graph.container) {
				this.setDisplay('none');
			}
		}));

		// Resets current state when in-place editor starts
		this.graph.addListener(mxEvent.START_EDITING, mxUtils.bind(this, function (evt) {
			this.reset();
		}));

		// Resets current state after update of selection state for touch events
		var graphClick = this.graph.click;
		this.graph.click = mxUtils.bind(this, function (me) {
			graphClick.apply(this.graph, arguments);

			if (this.currentState != null && !this.graph.isCellSelected(this.currentState.cell) &&
				mxEvent.isTouchEvent(me.getEvent()) && !this.graph.model.isVertex(me.getCell())) {
				this.reset();
			}
		});

		// Checks if connection handler was active in mouse move
		// as workaround for possible double connection inserted
		var connectionHandlerActive = false;

		// Implements a listener for hover and click handling
		this.graph.addMouseListener(
			{
				mouseDown: mxUtils.bind(this, function (sender, me) {
					connectionHandlerActive = false;
					var evt = me.getEvent();

					if (this.isResetEvent(evt)) {
						this.reset();
					}
					else if (!this.isActive()) {
						var state = this.getState(me.getState());

						if (state != null || !mxEvent.isTouchEvent(evt)) {
							this.update(state);
						}
					}

					this.setDisplay('none');
				}),
				mouseMove: mxUtils.bind(this, function (sender, me) {
					var evt = me.getEvent();

					if (this.isResetEvent(evt)) {
						this.reset();
					}
					else if (!this.graph.isMouseDown && !mxEvent.isTouchEvent(evt)) {
						this.update(this.getState(me.getState()),
							me.getGraphX(), me.getGraphY());
					}

					if (this.graph.connectionHandler != null &&
						this.graph.connectionHandler.shape != null) {
						connectionHandlerActive = true;
					}
				}),
				mouseUp: mxUtils.bind(this, function (sender, me) {
					var evt = me.getEvent();
					var pt = mxUtils.convertPoint(this.graph.container,
						mxEvent.getClientX(evt), mxEvent.getClientY(evt))

					if (this.isResetEvent(evt)) {
						this.reset();
					}
					else if (this.isActive() && !connectionHandlerActive &&
						this.mouseDownPoint != null) {
						this.click(this.currentState, this.getDirection(), me);
					}
					else if (this.isActive()) {
						// Selects target vertex after drag and clone if not only new edge was inserted
						if (this.graph.getSelectionCount() != 1 || !this.graph.model.isEdge(
							this.graph.getSelectionCell())) {
							this.update(this.getState(this.graph.view.getState(
								this.graph.getCellAt(me.getGraphX(), me.getGraphY()))));
						}
						else {
							this.reset();
						}
					}
					else if (mxEvent.isTouchEvent(evt) || (this.bbox != null &&
						mxUtils.contains(this.bbox, me.getGraphX(), me.getGraphY()))) {
						// Shows existing hover icons if inside bounding box
						this.setDisplay('');
						this.repaint();
					}
					else if (!mxEvent.isTouchEvent(evt)) {
						this.reset();
					}

					connectionHandlerActive = false;
					this.resetActiveArrow();
				})
			});
	};

	/**
	 * 
	 */
	HoverIcons.prototype.isResetEvent = function (evt, allowShift) {
		return mxEvent.isAltDown(evt) || (this.activeArrow == null && mxEvent.isShiftDown(evt)) ||
			mxEvent.isMetaDown(evt) || (mxEvent.isPopupTrigger(evt) && !mxEvent.isControlDown(evt));
	};

	/**
	 * 
	 */
	HoverIcons.prototype.createArrow = function (img, tooltip) {
		var arrow = null;

		if (mxClient.IS_IE && !mxClient.IS_SVG) {
			// Workaround for PNG images in IE6
			if (mxClient.IS_IE6 && document.compatMode != 'CSS1Compat') {
				arrow = document.createElement(mxClient.VML_PREFIX + ':image');
				arrow.setAttribute('src', img.src);
				arrow.style.borderStyle = 'none';
			}
			else {
				arrow = document.createElement('div');
				arrow.style.backgroundImage = 'url(' + img.src + ')';
				arrow.style.backgroundPosition = 'center';
				arrow.style.backgroundRepeat = 'no-repeat';
			}

			arrow.style.width = (img.width + 4) + 'px';
			arrow.style.height = (img.height + 4) + 'px';
			arrow.style.display = (mxClient.IS_QUIRKS) ? 'inline' : 'inline-block';
		}
		else {
			arrow = mxUtils.createImage(img.src);
			arrow.style.width = img.width + 'px';
			arrow.style.height = img.height + 'px';
			arrow.style.padding = this.tolerance + 'px';
		}

		if (tooltip != null) {
			arrow.setAttribute('title', tooltip);
		}

		arrow.style.position = 'absolute';
		arrow.style.cursor = this.cssCursor;

		mxEvent.addGestureListeners(arrow, mxUtils.bind(this, function (evt) {
			if (this.currentState != null && !this.isResetEvent(evt)) {
				this.mouseDownPoint = mxUtils.convertPoint(this.graph.container,
					mxEvent.getClientX(evt), mxEvent.getClientY(evt));
				this.drag(evt, this.mouseDownPoint.x, this.mouseDownPoint.y);
				this.activeArrow = arrow;
				this.setDisplay('none');
				mxEvent.consume(evt);
			}
		}));

		// Captures mouse events as events on graph
		mxEvent.redirectMouseEvents(arrow, this.graph, this.currentState);

		mxEvent.addListener(arrow, 'mouseenter', mxUtils.bind(this, function (evt) {
			// Workaround for Firefox firing mouseenter on touchend
			if (mxEvent.isMouseEvent(evt)) {
				if (this.activeArrow != null && this.activeArrow != arrow) {
					mxUtils.setOpacity(this.activeArrow, this.inactiveOpacity);
				}

				this.graph.connectionHandler.constraintHandler.reset();
				mxUtils.setOpacity(arrow, 100);
				this.activeArrow = arrow;
			}
		}));

		mxEvent.addListener(arrow, 'mouseleave', mxUtils.bind(this, function (evt) {
			// Workaround for IE11 firing this event on touch
			if (!this.graph.isMouseDown) {
				this.resetActiveArrow();
			}
		}));

		return arrow;
	};

	/**
	 * 
	 */
	HoverIcons.prototype.resetActiveArrow = function () {
		if (this.activeArrow != null) {
			mxUtils.setOpacity(this.activeArrow, this.inactiveOpacity);
			this.activeArrow = null;
		}
	};

	/**
	 * 
	 */
	HoverIcons.prototype.getDirection = function () {
		var dir = mxConstants.DIRECTION_EAST;

		if (this.activeArrow == this.arrowUp) {
			dir = mxConstants.DIRECTION_NORTH;
		}
		else if (this.activeArrow == this.arrowDown) {
			dir = mxConstants.DIRECTION_SOUTH;
		}
		else if (this.activeArrow == this.arrowLeft) {
			dir = mxConstants.DIRECTION_WEST;
		}

		return dir;
	};

	/**
	 * 
	 */
	HoverIcons.prototype.visitNodes = function (visitor) {
		for (var i = 0; i < this.elts.length; i++) {
			if (this.elts[i] != null) {
				visitor(this.elts[i]);
			}
		}
	};

	/**
	 * 
	 */
	HoverIcons.prototype.removeNodes = function () {
		this.visitNodes(function (elt) {
			if (elt.parentNode != null) {
				elt.parentNode.removeChild(elt);
			}
		});
	};

	/**
	 *
	 */
	HoverIcons.prototype.setDisplay = function (display) {
		this.visitNodes(function (elt) {
			elt.style.display = display;
		});
	};

	/**
	 *
	 */
	HoverIcons.prototype.isActive = function () {
		return this.activeArrow != null && this.currentState != null;
	};

	/**
	 *
	 */
	HoverIcons.prototype.drag = function (evt, x, y) {
		this.graph.popupMenuHandler.hideMenu();
		this.graph.stopEditing(false);

		// Checks if state was removed in call to stopEditing above
		if (this.currentState != null) {
			this.graph.connectionHandler.start(this.currentState, x, y);
			this.graph.isMouseTrigger = mxEvent.isMouseEvent(evt);
			this.graph.isMouseDown = true;

			// Hides handles for selection cell
			var handler = this.graph.selectionCellsHandler.getHandler(this.currentState.cell);

			if (handler != null) {
				handler.setHandlesVisible(false);
			}

			// Ctrl+shift drag sets source constraint
			var es = this.graph.connectionHandler.edgeState;

			if (evt != null && mxEvent.isShiftDown(evt) && mxEvent.isControlDown(evt) && es != null &&
				mxUtils.getValue(es.style, mxConstants.STYLE_EDGE, null) === 'orthogonalEdgeStyle') {
				var direction = this.getDirection();
				es.cell.style = mxUtils.setStyle(es.cell.style, 'sourcePortConstraint', direction);
				es.style['sourcePortConstraint'] = direction;
			}
		}
	};

	/**
	 *
	 */
	HoverIcons.prototype.getStateAt = function (state, x, y) {
		return this.graph.view.getState(this.graph.getCellAt(x, y));
	};

	/**
	 *
	 */
	HoverIcons.prototype.click = function (state, dir, me) {
		var evt = me.getEvent();
		var x = me.getGraphX();
		var y = me.getGraphY();

		var tmp = this.getStateAt(state, x, y);

		if (tmp != null && this.graph.model.isEdge(tmp.cell) && !mxEvent.isControlDown(evt) &&
			(tmp.getVisibleTerminalState(true) == state || tmp.getVisibleTerminalState(false) == state)) {
			this.graph.setSelectionCell(tmp.cell);
			this.reset();
		}
		else if (state != null) {
			var cells = this.graph.connectVertex(state.cell, dir, this.graph.defaultEdgeLength, evt);
			this.graph.selectCellsForConnectVertex(cells, evt, this);

			// Selects only target vertex if one exists
			if (cells.length == 2 && this.graph.model.isVertex(cells[1])) {
				this.graph.setSelectionCell(cells[1]);

				// Adds hover icons to new target vertex for touch devices
				if (mxEvent.isTouchEvent(evt)) {
					this.update(this.getState(this.graph.view.getState(cells[1])));
				}
				else {
					// Hides hover icons after click with mouse
					this.reset();
				}

				this.graph.scrollCellToVisible(cells[1]);
			}
			else {
				this.graph.setSelectionCells(cells);
			}
		}

		me.consume();
	};

	/**
	 * 
	 */
	HoverIcons.prototype.reset = function (clearTimeout) {
		clearTimeout = (clearTimeout == null) ? true : clearTimeout;

		if (clearTimeout && this.updateThread != null) {
			window.clearTimeout(this.updateThread);
		}

		this.mouseDownPoint = null;
		this.currentState = null;
		this.activeArrow = null;
		this.removeNodes();
		this.bbox = null;
	};

	/**
	 * 
	 */
	HoverIcons.prototype.repaint = function () {
		this.bbox = null;

		if (this.currentState != null) {
			// Checks if cell was deleted
			this.currentState = this.getState(this.currentState);

			// Cell was deleted	
			if (this.currentState != null &&
				this.graph.model.isVertex(this.currentState.cell) &&
				this.graph.isCellConnectable(this.currentState.cell)) {
				var bds = mxRectangle.fromRectangle(this.currentState);

				// Uses outer bounding box to take rotation into account
				if (this.currentState.shape != null && this.currentState.shape.boundingBox != null) {
					bds = mxRectangle.fromRectangle(this.currentState.shape.boundingBox);
				}

				bds.grow(this.graph.tolerance);
				bds.grow(this.arrowSpacing);

				var handler = this.graph.selectionCellsHandler.getHandler(this.currentState.cell);

				if (handler != null) {
					bds.x -= handler.horizontalOffset / 2;
					bds.y -= handler.verticalOffset / 2;
					bds.width += handler.horizontalOffset;
					bds.height += handler.verticalOffset;

					// Adds bounding box of rotation handle to avoid overlap
					if (handler.rotationShape != null && handler.rotationShape.node != null &&
						handler.rotationShape.node.style.visibility != 'hidden' &&
						handler.rotationShape.node.style.display != 'none' &&
						handler.rotationShape.boundingBox != null) {
						bds.add(handler.rotationShape.boundingBox);
					}
				}

				this.arrowUp.style.left = Math.round(this.currentState.getCenterX() - this.triangleUp.width / 2 - this.tolerance) + 'px';
				this.arrowUp.style.top = Math.round(bds.y - this.triangleUp.height - this.tolerance) + 'px';
				mxUtils.setOpacity(this.arrowUp, this.inactiveOpacity);

				this.arrowRight.style.left = Math.round(bds.x + bds.width - this.tolerance) + 'px';
				this.arrowRight.style.top = Math.round(this.currentState.getCenterY() - this.triangleRight.height / 2 - this.tolerance) + 'px';
				mxUtils.setOpacity(this.arrowRight, this.inactiveOpacity);

				this.arrowDown.style.left = this.arrowUp.style.left;
				this.arrowDown.style.top = Math.round(bds.y + bds.height - this.tolerance) + 'px';
				mxUtils.setOpacity(this.arrowDown, this.inactiveOpacity);

				this.arrowLeft.style.left = Math.round(bds.x - this.triangleLeft.width - this.tolerance) + 'px';
				this.arrowLeft.style.top = this.arrowRight.style.top;
				mxUtils.setOpacity(this.arrowLeft, this.inactiveOpacity);

				if (this.checkCollisions) {
					var right = this.graph.getCellAt(bds.x + bds.width +
						this.triangleRight.width / 2, this.currentState.getCenterY());
					var left = this.graph.getCellAt(bds.x - this.triangleLeft.width / 2, this.currentState.getCenterY());
					var top = this.graph.getCellAt(this.currentState.getCenterX(), bds.y - this.triangleUp.height / 2);
					var bottom = this.graph.getCellAt(this.currentState.getCenterX(), bds.y + bds.height + this.triangleDown.height / 2);

					// Shows hover icons large cell is behind all directions of current cell
					if (right != null && right == left && left == top && top == bottom) {
						right = null;
						left = null;
						top = null;
						bottom = null;
					}

					var currentGeo = this.graph.getCellGeometry(this.currentState.cell);

					var checkCollision = mxUtils.bind(this, function (cell, arrow) {
						var geo = this.graph.model.isVertex(cell) && this.graph.getCellGeometry(cell);

						// Ignores collision if vertex is more than 3 times the size of this vertex
						if (cell != null && !this.graph.model.isAncestor(cell, this.currentState.cell) &&
							(geo == null || currentGeo == null || (geo.height < 6 * currentGeo.height &&
								geo.width < 6 * currentGeo.width))) {
							arrow.style.visibility = 'hidden';
						}
						else {
							arrow.style.visibility = 'visible';
						}
					});

					checkCollision(right, this.arrowRight);
					checkCollision(left, this.arrowLeft);
					checkCollision(top, this.arrowUp);
					checkCollision(bottom, this.arrowDown);
				}
				else {
					this.arrowLeft.style.visibility = 'visible';
					this.arrowRight.style.visibility = 'visible';
					this.arrowUp.style.visibility = 'visible';
					this.arrowDown.style.visibility = 'visible';
				}

				if (this.graph.tooltipHandler.isEnabled()) {
					this.arrowLeft.setAttribute('title', mxResources.get('plusTooltip'));
					this.arrowRight.setAttribute('title', mxResources.get('plusTooltip'));
					this.arrowUp.setAttribute('title', mxResources.get('plusTooltip'));
					this.arrowDown.setAttribute('title', mxResources.get('plusTooltip'));
				}
				else {
					this.arrowLeft.removeAttribute('title');
					this.arrowRight.removeAttribute('title');
					this.arrowUp.removeAttribute('title');
					this.arrowDown.removeAttribute('title');
				}
			}
			else {
				this.reset();
			}

			// Updates bounding box
			if (this.currentState != null) {
				this.bbox = this.computeBoundingBox();

				// Adds tolerance for hover
				if (this.bbox != null) {
					this.bbox.grow(10);
				}
			}
		}
	};

	/**
	 * 
	 */
	HoverIcons.prototype.computeBoundingBox = function () {
		var bbox = (!this.graph.model.isEdge(this.currentState.cell)) ? mxRectangle.fromRectangle(this.currentState) : null;

		this.visitNodes(function (elt) {
			if (elt.parentNode != null) {
				var tmp = new mxRectangle(elt.offsetLeft, elt.offsetTop, elt.offsetWidth, elt.offsetHeight);

				if (bbox == null) {
					bbox = tmp;
				}
				else {
					bbox.add(tmp);
				}
			}
		});

		return bbox;
	};

	/**
	 * 
	 */
	HoverIcons.prototype.getState = function (state) {
		if (state != null) {
			var cell = state.cell;

			// Uses connectable parent vertex if child is not connectable
			if (this.graph.getModel().isVertex(cell) && !this.graph.isCellConnectable(cell)) {
				var parent = this.graph.getModel().getParent(cell);

				if (this.graph.getModel().isVertex(parent) && this.graph.isCellConnectable(parent)) {
					cell = parent;
				}
			}

			// Ignores locked cells and edges
			if (this.graph.isCellLocked(cell) || this.graph.model.isEdge(cell)) {
				cell = null;
			}

			state = this.graph.view.getState(cell);
		}

		return state;
	};

	/**
	 * 
	 */
	HoverIcons.prototype.update = function (state, x, y) {
		if (!this.graph.connectionArrowsEnabled) {
			this.reset();
		}
		else {
			var timeOnTarget = null;

			// Time on target
			if (this.prev != state || this.isActive()) {
				this.startTime = new Date().getTime();
				this.prev = state;
				timeOnTarget = 0;

				if (this.updateThread != null) {
					window.clearTimeout(this.updateThread);
				}

				if (state != null) {
					// Starts timer to update current state with no mouse events
					this.updateThread = window.setTimeout(mxUtils.bind(this, function () {
						if (!this.isActive() && !this.graph.isMouseDown &&
							!this.graph.panningHandler.isActive()) {
							this.prev = state;
							this.update(state, x, y);
						}
					}), this.updateDelay + 10);
				}
			}
			else if (this.startTime != null) {
				timeOnTarget = new Date().getTime() - this.startTime;
			}

			this.setDisplay('');

			if (this.currentState != null && this.currentState != state && timeOnTarget < this.activationDelay &&
				this.bbox != null && !mxUtils.contains(this.bbox, x, y)) {
				this.reset(false);
			}
			else if (this.currentState != null || timeOnTarget > this.activationDelay) {
				if (this.currentState != state && ((timeOnTarget > this.updateDelay && state != null) ||
					this.bbox == null || x == null || y == null || !mxUtils.contains(this.bbox, x, y))) {
					if (state != null && this.graph.isEnabled()) {
						this.removeNodes();
						this.setCurrentState(state);
						this.repaint();

						// Resets connection points on other focused cells
						if (this.graph.connectionHandler.constraintHandler.currentFocus != state) {
							this.graph.connectionHandler.constraintHandler.reset();
						}
					}
					else {
						this.reset();
					}
				}
			}
		}
	};

	/**
	 * 
	 */
	HoverIcons.prototype.setCurrentState = function (state) {
		if (state.style['portConstraint'] != 'eastwest') {
			this.graph.container.appendChild(this.arrowUp);
			this.graph.container.appendChild(this.arrowDown);
		}

		this.graph.container.appendChild(this.arrowRight);
		this.graph.container.appendChild(this.arrowLeft);
		this.currentState = state;
	};

	(function () {

		/**
		 * Reset the list of processed edges.
		 */
		var mxGraphViewResetValidationState = mxGraphView.prototype.resetValidationState;

		mxGraphView.prototype.resetValidationState = function () {
			mxGraphViewResetValidationState.apply(this, arguments);

			this.validEdges = [];
		};

		/**
		 * Updates jumps for valid edges and repaints if needed.
		 */
		var mxGraphViewValidateCellState = mxGraphView.prototype.validateCellState;

		mxGraphView.prototype.validateCellState = function (cell, recurse) {
			var state = this.getState(cell);

			// Forces repaint if jumps change on a valid edge
			if (state != null && this.graph.model.isEdge(state.cell) &&
				state.style != null && state.style[mxConstants.STYLE_CURVED] != 1 &&
				!state.invalid && this.updateLineJumps(state)) {
				this.graph.cellRenderer.redraw(state, false, this.isRendering());
			}

			state = mxGraphViewValidateCellState.apply(this, arguments);

			// Adds to the list of edges that may intersect with later edges
			if (state != null && this.graph.model.isEdge(state.cell) &&
				state.style[mxConstants.STYLE_CURVED] != 1) {
				// LATER: Reuse jumps for valid edges
				this.validEdges.push(state);
			}

			return state;
		};

		/**
		 * Forces repaint if routed points have changed.
		 */
		var mxCellRendererIsShapeInvalid = mxCellRenderer.prototype.isShapeInvalid;

		mxCellRenderer.prototype.isShapeInvalid = function (state, shape) {
			return mxCellRendererIsShapeInvalid.apply(this, arguments) ||
				(state.routedPoints != null && shape.routedPoints != null &&
					!mxUtils.equalPoints(shape.routedPoints, state.routedPoints))
		};


		/**
		 * Updates jumps for invalid edges.
		 */
		var mxGraphViewUpdateCellState = mxGraphView.prototype.updateCellState;

		mxGraphView.prototype.updateCellState = function (state) {
			mxGraphViewUpdateCellState.apply(this, arguments);

			// Updates jumps on invalid edge before repaint
			if (this.graph.model.isEdge(state.cell) &&
				state.style[mxConstants.STYLE_CURVED] != 1) {
				this.updateLineJumps(state);
			}
		};

		/**
		 * Updates the jumps between given state and processed edges.
		 */
		mxGraphView.prototype.updateLineJumps = function (state) {
			var pts = state.absolutePoints;

			if (Graph.lineJumpsEnabled) {
				var changed = state.routedPoints != null;
				var actual = null;

				if (pts != null && this.validEdges != null &&
					mxUtils.getValue(state.style, 'jumpStyle', 'none') !== 'none') {
					var thresh = 0.5 * this.scale;
					changed = false;
					actual = [];

					// Type 0 means normal waypoint, 1 means jump
					function addPoint(type, x, y) {
						var rpt = new mxPoint(x, y);
						rpt.type = type;

						actual.push(rpt);
						var curr = (state.routedPoints != null) ? state.routedPoints[actual.length - 1] : null;

						return curr == null || curr.type != type || curr.x != x || curr.y != y;
					};

					for (var i = 0; i < pts.length - 1; i++) {
						var p1 = pts[i + 1];
						var p0 = pts[i];
						var list = [];

						// Ignores waypoints on straight segments
						var pn = pts[i + 2];

						while (i < pts.length - 2 &&
							mxUtils.ptSegDistSq(p0.x, p0.y, pn.x, pn.y,
								p1.x, p1.y) < 1 * this.scale * this.scale) {
							p1 = pn;
							i++;
							pn = pts[i + 2];
						}

						changed = addPoint(0, p0.x, p0.y) || changed;

						// Processes all previous edges
						for (var e = 0; e < this.validEdges.length; e++) {
							var state2 = this.validEdges[e];
							var pts2 = state2.absolutePoints;

							if (pts2 != null && mxUtils.intersects(state, state2) && state2.style['noJump'] != '1') {
								// Compares each segment of the edge with the current segment
								for (var j = 0; j < pts2.length - 1; j++) {
									var p3 = pts2[j + 1];
									var p2 = pts2[j];

									// Ignores waypoints on straight segments
									pn = pts2[j + 2];

									while (j < pts2.length - 2 &&
										mxUtils.ptSegDistSq(p2.x, p2.y, pn.x, pn.y,
											p3.x, p3.y) < 1 * this.scale * this.scale) {
										p3 = pn;
										j++;
										pn = pts2[j + 2];
									}

									var pt = mxUtils.intersection(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

									// Handles intersection between two segments
									if (pt != null && (Math.abs(pt.x - p2.x) > thresh ||
										Math.abs(pt.y - p2.y) > thresh) &&
										(Math.abs(pt.x - p3.x) > thresh ||
											Math.abs(pt.y - p3.y) > thresh)) {
										var dx = pt.x - p0.x;
										var dy = pt.y - p0.y;
										var temp = { distSq: dx * dx + dy * dy, x: pt.x, y: pt.y };

										// Intersections must be ordered by distance from start of segment
										for (var t = 0; t < list.length; t++) {
											if (list[t].distSq > temp.distSq) {
												list.splice(t, 0, temp);
												temp = null;

												break;
											}
										}

										// Ignores multiple intersections at segment joint
										if (temp != null && (list.length == 0 ||
											list[list.length - 1].x !== temp.x ||
											list[list.length - 1].y !== temp.y)) {
											list.push(temp);
										}
									}
								}
							}
						}

						// Adds ordered intersections to routed points
						for (var j = 0; j < list.length; j++) {
							changed = addPoint(1, list[j].x, list[j].y) || changed;
						}
					}

					var pt = pts[pts.length - 1];
					changed = addPoint(0, pt.x, pt.y) || changed;
				}

				state.routedPoints = actual;

				return changed;
			}
			else {
				return false;
			}
		};

		/**
		 * Overrides painting the actual shape for taking into account jump style.
		 */
		var mxConnectorPaintLine = mxConnector.prototype.paintLine;

		mxConnector.prototype.paintLine = function (c, absPts, rounded) {
			// Required for checking dirty state
			this.routedPoints = (this.state != null) ? this.state.routedPoints : null;

			if (this.outline || this.state == null || this.style == null ||
				this.state.routedPoints == null || this.state.routedPoints.length == 0) {
				mxConnectorPaintLine.apply(this, arguments);
			}
			else {
				var arcSize = mxUtils.getValue(this.style, mxConstants.STYLE_ARCSIZE,
					mxConstants.LINE_ARCSIZE) / 2;
				var size = (parseInt(mxUtils.getValue(this.style, 'jumpSize',
					Graph.defaultJumpSize)) - 2) / 2 + this.strokewidth;
				var style = mxUtils.getValue(this.style, 'jumpStyle', 'none');
				var f = Editor.jumpSizeRatio;
				var moveTo = true;
				var last = null;
				var len = null;
				var pts = [];
				var n = null;
				c.begin();

				for (var i = 0; i < this.state.routedPoints.length; i++) {
					var rpt = this.state.routedPoints[i];
					var pt = new mxPoint(rpt.x / this.scale, rpt.y / this.scale);

					// Takes first and last point from passed-in array
					if (i == 0) {
						pt = absPts[0];
					}
					else if (i == this.state.routedPoints.length - 1) {
						pt = absPts[absPts.length - 1];
					}

					var done = false;

					// Type 1 is an intersection
					if (last != null && rpt.type == 1) {
						// Checks if next/previous points are too close
						var next = this.state.routedPoints[i + 1];
						var dx = next.x / this.scale - pt.x;
						var dy = next.y / this.scale - pt.y;
						var dist = dx * dx + dy * dy;

						if (n == null) {
							n = new mxPoint(pt.x - last.x, pt.y - last.y);
							len = Math.sqrt(n.x * n.x + n.y * n.y);
							n.x = n.x * size / len;
							n.y = n.y * size / len;
						}

						if (dist > size * size && len > 0) {
							var dx = last.x - pt.x;
							var dy = last.y - pt.y;
							var dist = dx * dx + dy * dy;

							if (dist > size * size) {
								var p0 = new mxPoint(pt.x - n.x, pt.y - n.y);
								var p1 = new mxPoint(pt.x + n.x, pt.y + n.y);
								pts.push(p0);

								this.addPoints(c, pts, rounded, arcSize, false, null, moveTo);

								var f = (Math.round(n.x) < 0 || (Math.round(n.x) == 0
									&& Math.round(n.y) <= 0)) ? 1 : -1;
								moveTo = false;

								if (style == 'sharp') {
									c.lineTo(p0.x - n.y * f, p0.y + n.x * f);
									c.lineTo(p1.x - n.y * f, p1.y + n.x * f);
									c.lineTo(p1.x, p1.y);
								}
								else if (style == 'arc') {
									f *= 1.3;
									c.curveTo(p0.x - n.y * f, p0.y + n.x * f,
										p1.x - n.y * f, p1.y + n.x * f,
										p1.x, p1.y);
								}
								else {
									c.moveTo(p1.x, p1.y);
									moveTo = true;
								}

								pts = [p1];
								done = true;
							}
						}
					}
					else {
						n = null;
					}

					if (!done) {
						pts.push(pt);
						last = pt;
					}
				}

				this.addPoints(c, pts, rounded, arcSize, false, null, moveTo);
				c.stroke();
			}
		};

		/**
		 * Adds support for snapToPoint style.
		 */
		var mxGraphViewUpdateFloatingTerminalPoint = mxGraphView.prototype.updateFloatingTerminalPoint;

		mxGraphView.prototype.updateFloatingTerminalPoint = function (edge, start, end, source) {
			if (start != null && edge != null &&
				(start.style['snapToPoint'] == '1' ||
					edge.style['snapToPoint'] == '1')) {
				start = this.getTerminalPort(edge, start, source);
				var next = this.getNextPoint(edge, end, source);

				var orth = this.graph.isOrthogonal(edge);
				var alpha = mxUtils.toRadians(Number(start.style[mxConstants.STYLE_ROTATION] || '0'));
				var center = new mxPoint(start.getCenterX(), start.getCenterY());

				if (alpha != 0) {
					var cos = Math.cos(-alpha);
					var sin = Math.sin(-alpha);
					next = mxUtils.getRotatedPoint(next, cos, sin, center);
				}

				var border = parseFloat(edge.style[mxConstants.STYLE_PERIMETER_SPACING] || 0);
				border += parseFloat(edge.style[(source) ?
					mxConstants.STYLE_SOURCE_PERIMETER_SPACING :
					mxConstants.STYLE_TARGET_PERIMETER_SPACING] || 0);
				var pt = this.getPerimeterPoint(start, next, alpha == 0 && orth, border);

				if (alpha != 0) {
					var cos = Math.cos(alpha);
					var sin = Math.sin(alpha);
					pt = mxUtils.getRotatedPoint(pt, cos, sin, center);
				}

				edge.setAbsoluteTerminalPoint(this.snapToAnchorPoint(edge, start, end, source, pt), source);
			}
			else {
				mxGraphViewUpdateFloatingTerminalPoint.apply(this, arguments);
			}
		};

		mxGraphView.prototype.snapToAnchorPoint = function (edge, start, end, source, pt) {
			if (start != null && edge != null) {
				var constraints = this.graph.getAllConnectionConstraints(start)
				var nearest = null;
				var dist = null;

				if (constraints != null) {
					for (var i = 0; i < constraints.length; i++) {
						var cp = this.graph.getConnectionPoint(start, constraints[i]);

						if (cp != null) {
							var tmp = (cp.x - pt.x) * (cp.x - pt.x) + (cp.y - pt.y) * (cp.y - pt.y);

							if (dist == null || tmp < dist) {
								nearest = cp;
								dist = tmp;
							}
						}
					}
				}

				if (nearest != null) {
					pt = nearest;
				}
			}

			return pt;
		};

		/**
		 * Adds support for placeholders in text elements of shapes.
		 */
		var mxStencilEvaluateTextAttribute = mxStencil.prototype.evaluateTextAttribute;

		mxStencil.prototype.evaluateTextAttribute = function (node, attribute, shape) {
			var result = mxStencilEvaluateTextAttribute.apply(this, arguments);
			var placeholders = node.getAttribute('placeholders');

			if (placeholders == '1' && shape.state != null) {
				result = shape.state.view.graph.replacePlaceholders(shape.state.cell, result);
			}

			return result;
		};

		/**
		 * Adds custom stencils defined via shape=stencil(value) style. The value is a base64 encoded, compressed and
		 * URL encoded XML definition of the shape according to the stencil definition language of mxGraph.
		 * 
		 * Needs to be in this file to make sure its part of the embed client code. Also the check for ZLib is
		 * different than for the Editor code.
		 */
		var mxCellRendererCreateShape = mxCellRenderer.prototype.createShape;
		mxCellRenderer.prototype.createShape = function (state) {
			if (state.style != null && typeof (pako) !== 'undefined') {
				var shape = mxUtils.getValue(state.style, mxConstants.STYLE_SHAPE, null);

				// Extracts and decodes stencil XML if shape has the form shape=stencil(value)
				if (shape != null && shape.substring(0, 8) == 'stencil(') {
					try {
						var stencil = shape.substring(8, shape.length - 1);
						var doc = mxUtils.parseXml(state.view.graph.decompress(stencil));

						return new mxShape(new mxStencil(doc.documentElement));
					}
					catch (e) {
						if (window.console != null) {
							console.error('Error in shape: ' + e);
						}
					}
				}
			}

			return mxCellRendererCreateShape.apply(this, arguments);
		};
	})();

	/**
	 * Overrides stencil registry for dynamic loading of stencils.
	 */
	/**
	 * Maps from library names to an array of Javascript filenames,
	 * which are synchronously loaded. Currently only stencil files
	 * (.xml) and JS files (.js) are supported.
	 * IMPORTANT: For embedded diagrams to work entries must also
	 * be added in EmbedServlet.java.
	 */
	mxStencilRegistry.libraries = {};

	/**
	 * Global switch to disable dynamic loading.
	 */
	mxStencilRegistry.dynamicLoading = true;

	/**
	 * Global switch to disable eval for JS (preload all JS instead).
	 */
	mxStencilRegistry.allowEval = true;

	/**
	 * Stores all package names that have been dynamically loaded.
	 * Each package is only loaded once.
	 */
	mxStencilRegistry.packages = [];

	// Extends the default stencil registry to add dynamic loading
	mxStencilRegistry.getStencil = function (name) {
		// console.debug("mxStencilRegistry.getStencil name", name)
		var result = mxStencilRegistry.stencils[name];
		if (result == null && mxCellRenderer.defaultShapes[name] == null && mxStencilRegistry.dynamicLoading) {
			var basename = mxStencilRegistry.getBasenameForStencil(name);
			// console.debug("mxStencilRegistry.getStencil basename", basename)
			// Loads stencil files and tries again
			if (basename != null) {
				var libs = mxStencilRegistry.libraries[basename];

				if (libs != null) {
					if (mxStencilRegistry.packages[basename] == null) {
						for (var i = 0; i < libs.length; i++) {
							var fname = libs[i];

							if (fname.toLowerCase().substring(fname.length - 4, fname.length) == '.xml') {
								mxStencilRegistry.loadStencilSet(fname, null);
							}
							else if (fname.toLowerCase().substring(fname.length - 3, fname.length) == '.js') {
								try {
									if (mxStencilRegistry.allowEval) {
										var req = mxUtils.load(fname);

										if (req != null && req.getStatus() >= 200 && req.getStatus() <= 299) {
											eval.call(window, req.getText());
										}
									}
								}
								catch (e) {
									if (window.console != null) {
										console.error('error in getStencil:', fname, e);
									}
								}
							}
							else {
								// FIXME: This does not yet work as the loading is triggered after
								// the shape was used in the graph, at which point the keys have
								// typically been translated in the calling method.
								//mxResources.add(fname);
							}
						}

						mxStencilRegistry.packages[basename] = 1;
					}
				}
				else {
					// Replaces '_-_' with '_'
					basename = basename.replace('_-_', '_');
					mxStencilRegistry.loadStencilSet(STENCIL_PATH + '/' + basename + '.xml', null);
				}

				result = mxStencilRegistry.stencils[name];
			}
		}

		return result;
	};

	// Returns the basename for the given stencil or null if no file must be
	// loaded to render the given stencil.
	mxStencilRegistry.getBasenameForStencil = function (name) {
		var tmp = null;

		if (name != null) {
			var parts = name.split('.');

			if (parts.length > 0 && parts[0] == 'mxgraph') {
				tmp = parts[1];

				for (var i = 2; i < parts.length - 1; i++) {
					tmp += '/' + parts[i];
				}
			}
		}

		return tmp;
	};

	// Loads the given stencil set
	mxStencilRegistry.loadStencilSet = function (stencilFile, postStencilLoad, force, async) {
		force = (force != null) ? force : false;

		// Uses additional cache for detecting previous load attempts
		var xmlDoc = mxStencilRegistry.packages[stencilFile];

		if (force || xmlDoc == null) {
			var install = false;

			if (xmlDoc == null) {
				try {
					if (async) {
						mxStencilRegistry.loadStencil(stencilFile, mxUtils.bind(this, function (xmlDoc2) {
							if (xmlDoc2 != null && xmlDoc2.documentElement != null) {
								mxStencilRegistry.packages[stencilFile] = xmlDoc2;
								install = true;
								mxStencilRegistry.parseStencilSet(xmlDoc2.documentElement, postStencilLoad, install);
							}
						}));

						return;
					}
					else {
						xmlDoc = mxStencilRegistry.loadStencil(stencilFile);
						mxStencilRegistry.packages[stencilFile] = xmlDoc;
						install = true;
					}
				}
				catch (e) {
					if (window.console != null) {
						console.error('error in loadStencilSet:', stencilFile, e);
					}
				}
			}

			if (xmlDoc != null && xmlDoc.documentElement != null) {
				mxStencilRegistry.parseStencilSet(xmlDoc.documentElement, postStencilLoad, install);
			}
		}
	};

	// Loads the given stencil XML file.
	mxStencilRegistry.loadStencil = function (filename, fn) {
		if (fn != null) {
			var req = mxUtils.get(filename, mxUtils.bind(this, function (req) {
				fn((req.getStatus() >= 200 && req.getStatus() <= 299) ? req.getXml() : null);
			}));
		}
		else {
			return mxUtils.load(filename).getXml();
		}
	};

	// Takes array of strings
	mxStencilRegistry.parseStencilSets = function (stencils) {
		for (var i = 0; i < stencils.length; i++) {
			mxStencilRegistry.parseStencilSet(mxUtils.parseXml(stencils[i]).documentElement);
		}
	};

	// Parses the given stencil set
	mxStencilRegistry.parseStencilSet = function (root, postStencilLoad, install) {
		if (root.nodeName == 'stencils') {
			var shapes = root.firstChild;

			while (shapes != null) {
				if (shapes.nodeName == 'shapes') {
					mxStencilRegistry.parseStencilSet(shapes, postStencilLoad, install);
				}

				shapes = shapes.nextSibling;
			}
		}
		else {
			install = (install != null) ? install : true;
			var shape = root.firstChild;
			var packageName = '';
			var name = root.getAttribute('name');

			if (name != null) {
				packageName = name + '.';
			}

			while (shape != null) {
				if (shape.nodeType == mxConstants.NODETYPE_ELEMENT) {
					name = shape.getAttribute('name');

					if (name != null) {
						packageName = packageName.toLowerCase();
						var stencilName = name.replace(/ /g, "_");

						if (install) {
							mxStencilRegistry.addStencil(packageName + stencilName.toLowerCase(), new mxStencil(shape));
						}

						if (postStencilLoad != null) {
							var w = shape.getAttribute('w');
							var h = shape.getAttribute('h');

							w = (w == null) ? 80 : parseInt(w, 10);
							h = (h == null) ? 80 : parseInt(h, 10);

							postStencilLoad(packageName, stencilName, name, w, h);
						}
					}
				}

				shape = shape.nextSibling;
			}
		}
	};

	/**
	 * These overrides are only added if mxVertexHandler is defined (ie. not in embedded graph)
	 */
	if (typeof mxVertexHandler != 'undefined') {
		(function () {
			// Sets colors for handles
			mxConstants.HANDLE_FILLCOLOR = '#29b6f2';
			mxConstants.HANDLE_STROKECOLOR = '#0088cf';
			mxConstants.VERTEX_SELECTION_COLOR = '#00a8ff';
			mxConstants.OUTLINE_COLOR = '#00a8ff';
			mxConstants.OUTLINE_HANDLE_FILLCOLOR = '#99ccff';
			mxConstants.OUTLINE_HANDLE_STROKECOLOR = '#00a8ff';
			mxConstants.CONNECT_HANDLE_FILLCOLOR = '#cee7ff';
			mxConstants.EDGE_SELECTION_COLOR = '#00a8ff';
			mxConstants.DEFAULT_VALID_COLOR = '#00a8ff';
			mxConstants.LABEL_HANDLE_FILLCOLOR = '#cee7ff';
			mxConstants.GUIDE_COLOR = '#0088cf';
			mxConstants.HIGHLIGHT_OPACITY = 30;
			mxConstants.HIGHLIGHT_SIZE = 5;

			// Enables snapping to off-grid terminals for edge waypoints
			mxEdgeHandler.prototype.snapToTerminals = true;

			// Enables guides
			mxGraphHandler.prototype.guidesEnabled = true;

			// Enables fading of rubberband
			mxRubberband.prototype.fadeOut = true;

			// Alt-move disables guides
			mxGuide.prototype.isEnabledForEvent = function (evt) {
				return !mxEvent.isAltDown(evt);
			};

			// Extends connection handler to enable ctrl+drag for cloning source cell
			// since copyOnConnect is now disabled by default
			var mxConnectionHandlerCreateTarget = mxConnectionHandler.prototype.isCreateTarget;
			mxConnectionHandler.prototype.isCreateTarget = function (evt) {
				return mxEvent.isControlDown(evt) || mxConnectionHandlerCreateTarget.apply(this, arguments);
			};

			// Overrides highlight shape for connection points
			mxConstraintHandler.prototype.createHighlightShape = function () {
				var hl = new mxEllipse(null, this.highlightColor, this.highlightColor, 0);
				hl.opacity = mxConstants.HIGHLIGHT_OPACITY;

				return hl;
			};

			// Overrides edge preview to use current edge shape and default style
			mxConnectionHandler.prototype.livePreview = true;
			mxConnectionHandler.prototype.cursor = 'crosshair';

			// Uses current edge style for connect preview
			mxConnectionHandler.prototype.createEdgeState = function (me) {
				var style = this.graph.createCurrentEdgeStyle();
				var edge = this.graph.createEdge(null, null, null, null, null, style);
				var state = new mxCellState(this.graph.view, edge, this.graph.getCellStyle(edge));

				for (var key in this.graph.currentEdgeStyle) {
					state.style[key] = this.graph.currentEdgeStyle[key];
				}

				return state;
			};

			// Overrides dashed state with current edge style
			var connectionHandlerCreateShape = mxConnectionHandler.prototype.createShape;
			mxConnectionHandler.prototype.createShape = function () {
				var shape = connectionHandlerCreateShape.apply(this, arguments);

				shape.isDashed = this.graph.currentEdgeStyle[mxConstants.STYLE_DASHED] == '1';

				return shape;
			}

			// Overrides live preview to keep current style
			mxConnectionHandler.prototype.updatePreview = function (valid) {
				// do not change color of preview
			};

			// Overrides connection handler to ignore edges instead of not allowing connections
			var mxConnectionHandlerCreateMarker = mxConnectionHandler.prototype.createMarker;
			mxConnectionHandler.prototype.createMarker = function () {
				var marker = mxConnectionHandlerCreateMarker.apply(this, arguments);

				var markerGetCell = marker.getCell;
				marker.getCell = mxUtils.bind(this, function (me) {
					var result = markerGetCell.apply(this, arguments);

					this.error = null;

					return result;
				});

				return marker;
			};

			/**
			 * Function: isCellLocked
			 * 
			 * Returns true if the given cell does not allow new connections to be created.
			 * This implementation returns false.
			 */
			mxConnectionHandler.prototype.isCellEnabled = function (cell) {
				return !this.graph.isCellLocked(cell);
			};

			/**
			 * 
			 */
			Graph.prototype.defaultVertexStyle = {};

			/**
			 * Contains the default style for edges.
			 */
			Graph.prototype.defaultEdgeStyle = {
				'edgeStyle': 'orthogonalEdgeStyle', 'rounded': '0',
				'jettySize': 'auto', 'orthogonalLoop': '1'
			};

			/**
			 * Returns the current edge style as a string.
			 */
			Graph.prototype.createCurrentEdgeStyle = function () {
				var style = 'edgeStyle=' + (this.currentEdgeStyle['edgeStyle'] || 'none') + ';';

				if (this.currentEdgeStyle['shape'] != null) {
					style += 'shape=' + this.currentEdgeStyle['shape'] + ';';
				}

				if (this.currentEdgeStyle['curved'] != null) {
					style += 'curved=' + this.currentEdgeStyle['curved'] + ';';
				}

				if (this.currentEdgeStyle['rounded'] != null) {
					style += 'rounded=' + this.currentEdgeStyle['rounded'] + ';';
				}

				if (this.currentEdgeStyle['comic'] != null) {
					style += 'comic=' + this.currentEdgeStyle['comic'] + ';';
				}

				if (this.currentEdgeStyle['jumpStyle'] != null) {
					style += 'jumpStyle=' + this.currentEdgeStyle['jumpStyle'] + ';';
				}

				if (this.currentEdgeStyle['jumpSize'] != null) {
					style += 'jumpSize=' + this.currentEdgeStyle['jumpSize'] + ';';
				}

				// Special logic for custom property of elbowEdgeStyle
				if (this.currentEdgeStyle['edgeStyle'] == 'elbowEdgeStyle' && this.currentEdgeStyle['elbow'] != null) {
					style += 'elbow=' + this.currentEdgeStyle['elbow'] + ';';
				}

				if (this.currentEdgeStyle['html'] != null) {
					style += 'html=' + this.currentEdgeStyle['html'] + ';';
				}
				else {
					style += 'html=1;';
				}

				return style;
			};

			/**
			 * Hook for subclassers.
			 */
			Graph.prototype.getPagePadding = function () {
				return new mxPoint(0, 0);
			};

			/**
			 * Loads the stylesheet for this graph.
			 */
			Graph.prototype.loadStylesheet = function () {
				// var node = (this.themes != null) ? this.themes[this.defaultThemeName] : (!mxStyleRegistry.dynamicLoading) ? null : mxUtils.load(STYLE_PATH + '/default.xml').getDocumentElement();
				var node = mxUtils.load(STYLE_PATH + '/default.xml').getDocumentElement();

				if (node != null) {
					var dec = new mxCodec(node.ownerDocument);
					dec.decode(node, this.getStylesheet());
				}
			};

			/**
			 * 
			 */
			Graph.prototype.importGraphModel = function (node, dx, dy, crop) {
				dx = (dx != null) ? dx : 0;
				dy = (dy != null) ? dy : 0;

				var codec = new mxCodec(node.ownerDocument);
				var tempModel = new mxGraphModel();
				codec.decode(node, tempModel);
				var cells = []

				// Clones cells to remove invalid edges
				var layers = tempModel.getChildren(this.cloneCell(
					tempModel.root, this.isCloneInvalidEdges()));

				if (layers != null) {
					// Uses copy as layers are removed from array inside loop
					layers = layers.slice();

					this.model.beginUpdate();
					try {
						// Merges into unlocked current layer if one layer is pasted
						if (layers.length == 1 && !this.isCellLocked(this.getDefaultParent())) {
							cells = this.moveCells(tempModel.getChildren(layers[0]),
								dx, dy, false, this.getDefaultParent());
						}
						else {
							for (var i = 0; i < layers.length; i++) {
								cells = cells.concat(this.model.getChildren(this.moveCells(
									[layers[i]], dx, dy, false, this.model.getRoot())[0]));
							}
						}

						if (crop) {
							if (this.isGridEnabled()) {
								dx = this.snap(dx);
								dy = this.snap(dy);
							}

							var bounds = this.getBoundingBoxFromGeometry(cells, true);

							if (bounds != null) {
								this.moveCells(cells, dx - bounds.x, dy - bounds.y);
							}
						}
					}
					finally {
						this.model.endUpdate();
					}
				}

				return cells;
			};

			/**
			 * Overrides method to provide connection constraints for shapes.
			 */
			Graph.prototype.getAllConnectionConstraints = function (terminal, source) {
				if (terminal != null) {
					var constraints = (terminal.shape != null) ? terminal.shape.getConstraints(terminal.style) : null;

					if (constraints != null) {
						return constraints;
					}
					else {
						constraints = mxUtils.getValue(terminal.style, 'points', null);

						if (constraints != null) {
							// Requires an array of arrays with x, y (0..1) and an optional
							// perimeter (0 or 1), eg. points=[[0,0,1],[0,1,0],[1,1]]
							var result = [];

							try {
								var c = JSON.parse(constraints);

								for (var i = 0; i < c.length; i++) {
									var tmp = c[i];
									result.push(new mxConnectionConstraint(new mxPoint(tmp[0], tmp[1]), (tmp.length > 2) ? tmp[2] != '0' : true));
								}
							}
							catch (e) {
								// ignore
							}

							return result;
						}
						else if (terminal.shape != null) {
							if (terminal.shape.stencil != null) {
								if (terminal.shape.stencil != null) {
									return terminal.shape.stencil.constraints;
								}
							}
							else if (terminal.shape.constraints != null) {
								return terminal.shape.constraints;
							}
						}
					}
				}

				return null;
			};

			/**
			 * Inverts the elbow edge style without removing existing styles.
			 */
			Graph.prototype.flipEdge = function (edge) {
				if (edge != null) {
					var state = this.view.getState(edge);
					var style = (state != null) ? state.style : this.getCellStyle(edge);

					if (style != null) {
						var elbow = mxUtils.getValue(style, mxConstants.STYLE_ELBOW,
							mxConstants.ELBOW_HORIZONTAL);
						var value = (elbow == mxConstants.ELBOW_HORIZONTAL) ?
							mxConstants.ELBOW_VERTICAL : mxConstants.ELBOW_HORIZONTAL;
						this.setCellStyles(mxConstants.STYLE_ELBOW, value, [edge]);
					}
				}
			};

			/**
			 * Disables drill-down for non-swimlanes.
			 */
			Graph.prototype.isValidRoot = function (cell) {
				// Counts non-relative children
				var childCount = this.model.getChildCount(cell);
				var realChildCount = 0;

				for (var i = 0; i < childCount; i++) {
					var child = this.model.getChildAt(cell, i);

					if (this.model.isVertex(child)) {
						var geometry = this.getCellGeometry(child);

						if (geometry != null && !geometry.relative) {
							realChildCount++;
						}
					}
				}

				return realChildCount > 0 || this.isContainer(cell);
			};

			/**
			 * Disables drill-down for non-swimlanes.
			 */
			Graph.prototype.isValidDropTarget = function (cell) {
				var state = this.view.getState(cell);
				var style = (state != null) ? state.style : this.getCellStyle(cell);

				return mxUtils.getValue(style, 'part', '0') != '1' && (this.isContainer(cell) ||
					(mxGraph.prototype.isValidDropTarget.apply(this, arguments) &&
						mxUtils.getValue(style, 'dropTarget', '1') != '0'));
			};

			/**
			 * Overrides createGroupCell to set the group style for new groups to 'group'.
			 */
			Graph.prototype.createGroupCell = function () {
				var group = mxGraph.prototype.createGroupCell.apply(this, arguments);
				group.setStyle('group');

				return group;
			};

			/**
			 * Disables extending parents with stack layouts on add
			 */
			Graph.prototype.isExtendParentsOnAdd = function (cell) {
				var result = mxGraph.prototype.isExtendParentsOnAdd.apply(this, arguments);

				if (result && cell != null && this.layoutManager != null) {
					var parent = this.model.getParent(cell);

					if (parent != null) {
						var layout = this.layoutManager.getLayout(parent);

						if (layout != null && layout.constructor == mxStackLayout) {
							result = false;
						}
					}
				}

				return result;
			};

			/**
			 * Overrides autosize to add a border.
			 */
			Graph.prototype.getPreferredSizeForCell = function (cell) {
				var result = mxGraph.prototype.getPreferredSizeForCell.apply(this, arguments);

				// Adds buffer
				if (result != null) {
					result.width += 10;
					result.height += 4;

					if (this.gridEnabled) {
						result.width = this.snap(result.width);
						result.height = this.snap(result.height);
					}
				}

				return result;
			}

			/**
			 * Turns the given cells and returns the changed cells.
			 */
			Graph.prototype.turnShapes = function (cells) {
				var model = this.getModel();
				var select = [];

				model.beginUpdate();
				try {
					for (var i = 0; i < cells.length; i++) {
						var cell = cells[i];

						if (model.isEdge(cell)) {
							var src = model.getTerminal(cell, true);
							var trg = model.getTerminal(cell, false);

							model.setTerminal(cell, trg, true);
							model.setTerminal(cell, src, false);

							var geo = model.getGeometry(cell);

							if (geo != null) {
								geo = geo.clone();

								if (geo.points != null) {
									geo.points.reverse();
								}

								var sp = geo.getTerminalPoint(true);
								var tp = geo.getTerminalPoint(false)

								geo.setTerminalPoint(sp, false);
								geo.setTerminalPoint(tp, true);
								model.setGeometry(cell, geo);

								// Inverts constraints
								var edgeState = this.view.getState(cell);
								var sourceState = this.view.getState(src);
								var targetState = this.view.getState(trg);

								if (edgeState != null) {
									var sc = (sourceState != null) ? this.getConnectionConstraint(edgeState, sourceState, true) : null;
									var tc = (targetState != null) ? this.getConnectionConstraint(edgeState, targetState, false) : null;

									this.setConnectionConstraint(cell, src, true, tc);
									this.setConnectionConstraint(cell, trg, false, sc);
								}

								select.push(cell);
							}
						}
						else if (model.isVertex(cell)) {
							var geo = this.getCellGeometry(cell);

							if (geo != null) {
								// Rotates the size and position in the geometry
								geo = geo.clone();
								geo.x += geo.width / 2 - geo.height / 2;
								geo.y += geo.height / 2 - geo.width / 2;
								var tmp = geo.width;
								geo.width = geo.height;
								geo.height = tmp;
								model.setGeometry(cell, geo);

								// Reads the current direction and advances by 90 degrees
								var state = this.view.getState(cell);

								if (state != null) {
									var dir = state.style[mxConstants.STYLE_DIRECTION] || 'east'/*default*/;

									if (dir == 'east') {
										dir = 'south';
									}
									else if (dir == 'south') {
										dir = 'west';
									}
									else if (dir == 'west') {
										dir = 'north';
									}
									else if (dir == 'north') {
										dir = 'east';
									}

									this.setCellStyles(mxConstants.STYLE_DIRECTION, dir, [cell]);
								}

								select.push(cell);
							}
						}
					}
				}
				finally {
					model.endUpdate();
				}

				return select;
			};

			/**
			 * Returns true if the given stencil contains any placeholder text.
			 */
			Graph.prototype.stencilHasPlaceholders = function (stencil) {
				if (stencil != null && stencil.fgNode != null) {
					var node = stencil.fgNode.firstChild;

					while (node != null) {
						if (node.nodeName == 'text' && node.getAttribute('placeholders') == '1') {
							return true;
						}

						node = node.nextSibling;
					}
				}

				return false;
			};

			/**
			 * Updates the child cells with placeholders if metadata of a cell has changed.
			 */
			Graph.prototype.processChange = function (change) {
				mxGraph.prototype.processChange.apply(this, arguments);
				if (!isNaN(mxValueChange) && change instanceof mxValueChange && change.cell != null &&
					change.cell.value != null && typeof (change.cell.value) == 'object') {
					// Invalidates all descendants with placeholders
					var desc = this.model.getDescendants(change.cell);

					// LATER: Check if only label or tooltip have changed
					if (desc.length > 0) {
						for (var i = 0; i < desc.length; i++) {
							var state = this.view.getState(desc[i]);

							if (state != null && state.shape != null && state.shape.stencil != null &&
								this.stencilHasPlaceholders(state.shape.stencil)) {
								this.removeStateForCell(desc[i]);
							}
							else if (this.isReplacePlaceholders(desc[i])) {
								this.view.invalidate(desc[i], false, false);
							}
						}
					}
				}
			};

			/**
			 * Replaces the given element with a span.
			 */
			Graph.prototype.replaceElement = function (elt, tagName) {
				var span = elt.ownerDocument.createElement((tagName != null) ? tagName : 'span');
				var attributes = Array.prototype.slice.call(elt.attributes);

				while (attr = attributes.pop()) {
					span.setAttribute(attr.nodeName, attr.nodeValue);
				}

				span.innerHTML = elt.innerHTML;
				elt.parentNode.replaceChild(span, elt);
			};

			/**
			 * Handles label changes for XML user objects.
			 */
			Graph.prototype.updateLabelElements = function (cells, fn, tagName) {
				cells = (cells != null) ? cells : this.getSelectionCells();
				var div = document.createElement('div');

				for (var i = 0; i < cells.length; i++) {
					// Changes font tags inside HTML labels
					if (this.isHtmlLabel(cells[i])) {
						var label = this.convertValueToString(cells[i]);

						if (label != null && label.length > 0) {
							div.innerHTML = label;
							var elts = div.getElementsByTagName((tagName != null) ? tagName : '*');

							for (var j = 0; j < elts.length; j++) {
								fn(elts[j]);
							}

							if (div.innerHTML != label) {
								this.cellLabelChanged(cells[i], div.innerHTML);
							}
						}
					}
				}
			};

			/**
			 * Handles label changes for XML user objects.
			 */
			Graph.prototype.cellLabelChanged = function (cell, value, autoSize) {
				// Removes all illegal control characters in user input
				value = this.zapGremlins(value);

				this.model.beginUpdate();
				try {
					if (cell.value != null && typeof cell.value == 'object') {
						if (this.isReplacePlaceholders(cell) &&
							cell.getAttribute('placeholder') != null) {
							// LATER: Handle delete, name change
							var name = cell.getAttribute('placeholder');
							var current = cell;

							while (current != null) {
								if (current == this.model.getRoot() || (current.value != null &&
									typeof (current.value) == 'object' && current.hasAttribute(name))) {
									this.setAttributeForCell(current, name, value);

									break;
								}

								current = this.model.getParent(current);
							}
						}

						var tmp = cell.value.cloneNode(true);
						tmp.setAttribute('label', value);
						value = tmp;
					}

					mxGraph.prototype.cellLabelChanged.apply(this, arguments);
				}
				finally {
					this.model.endUpdate();
				}
			};

			/**
			 * Removes transparent empty groups if all children are removed.
			 */
			Graph.prototype.cellsRemoved = function (cells) {
				if (cells != null) {
					var dict = new mxDictionary();

					for (var i = 0; i < cells.length; i++) {
						dict.put(cells[i], true);
					}

					// LATER: Recurse up the cell hierarchy
					var parents = [];

					for (var i = 0; i < cells.length; i++) {
						var parent = this.model.getParent(cells[i]);

						if (parent != null && !dict.get(parent)) {
							dict.put(parent, true);
							parents.push(parent);
						}
					}

					for (var i = 0; i < parents.length; i++) {
						var state = this.view.getState(parents[i]);

						if (state != null && (this.model.isEdge(state.cell) || this.model.isVertex(state.cell)) && this.isCellDeletable(state.cell)) {
							var stroke = mxUtils.getValue(state.style, mxConstants.STYLE_STROKECOLOR, mxConstants.NONE);
							var fill = mxUtils.getValue(state.style, mxConstants.STYLE_FILLCOLOR, mxConstants.NONE);

							if (stroke == mxConstants.NONE && fill == mxConstants.NONE) {
								var allChildren = true;

								for (var j = 0; j < this.model.getChildCount(state.cell) && allChildren; j++) {
									if (!dict.get(this.model.getChildAt(state.cell, j))) {
										allChildren = false;
									}
								}

								if (allChildren) {
									cells.push(state.cell);
								}
							}
						}
					}
				}

				mxGraph.prototype.cellsRemoved.apply(this, arguments);
			};

			/**
			 * Overrides ungroup to check if group should be removed.
			 */
			Graph.prototype.removeCellsAfterUngroup = function (cells) {
				var cellsToRemove = [];

				for (var i = 0; i < cells.length; i++) {
					if (this.isCellDeletable(cells[i])) {
						var state = this.view.getState(cells[i]);

						if (state != null) {
							var stroke = mxUtils.getValue(state.style, mxConstants.STYLE_STROKECOLOR, mxConstants.NONE);
							var fill = mxUtils.getValue(state.style, mxConstants.STYLE_FILLCOLOR, mxConstants.NONE);

							if (stroke == mxConstants.NONE && fill == mxConstants.NONE) {
								cellsToRemove.push(cells[i]);
							}
						}
					}
				}

				cells = cellsToRemove;

				mxGraph.prototype.removeCellsAfterUngroup.apply(this, arguments);
			};

			/**
			 * Sets the link for the given cell.
			 */
			Graph.prototype.setLinkForCell = function (cell, link) {
				this.setAttributeForCell(cell, 'link', link);
			};

			/**
			 * Sets the link for the given cell.
			 */
			Graph.prototype.setTooltipForCell = function (cell, link) {
				this.setAttributeForCell(cell, 'tooltip', link);
			};

			/**
			 * Sets the link for the given cell.
			 */
			Graph.prototype.setAttributeForCell = function (cell, attributeName, attributeValue) {
				var value = null;

				if (cell.value != null && typeof (cell.value) == 'object') {
					value = cell.value.cloneNode(true);
				}
				else {
					var doc = mxUtils.createXmlDocument();

					value = doc.createElement('UserObject');
					value.setAttribute('label', cell.value || '');
				}

				if (attributeValue != null && attributeValue.length > 0) {
					value.setAttribute(attributeName, attributeValue);
				}
				else {
					value.removeAttribute(attributeName);
				}

				this.model.setValue(cell, value);
			};

			/**
			 * Overridden to stop moving edge labels between cells.
			 */
			Graph.prototype.getDropTarget = function (cells, evt, cell, clone) {
				var model = this.getModel();

				// Disables drop into group if alt is pressed
				if (mxEvent.isAltDown(evt)) {
					return null;
				}

				// Disables dragging edge labels out of edges
				for (var i = 0; i < cells.length; i++) {
					if (this.model.isEdge(this.model.getParent(cells[i]))) {
						return null;
					}
				}

				return mxGraph.prototype.getDropTarget.apply(this, arguments);
			};

			/**
			 * Overrides double click handling to avoid accidental inserts of new labels in dblClick below.
			 */
			Graph.prototype.click = function (me) {
				mxGraph.prototype.click.call(this, me);

				// Stores state and source for checking in dblClick
				this.firstClickState = me.getState();
				this.firstClickSource = me.getSource();
			};

			/**
			 * Overrides double click handling to add the tolerance and inserting text.
			 */
			Graph.prototype.dblClick = function (evt, cell) {
				if (this.isEnabled()) {
					var pt = mxUtils.convertPoint(this.container, mxEvent.getClientX(evt), mxEvent.getClientY(evt));

					// Automatically adds new child cells to edges on double click
					if (evt != null && !this.model.isVertex(cell)) {
						var state = (this.model.isEdge(cell)) ? this.view.getState(cell) : null;
						var src = mxEvent.getSource(evt);

						if (this.firstClickState == state && this.firstClickSource == src) {
							if (state == null || (state.text == null || state.text.node == null ||
								(!mxUtils.contains(state.text.boundingBox, pt.x, pt.y) &&
									!mxUtils.isAncestorNode(state.text.node, mxEvent.getSource(evt))))) {
								if ((state == null && !this.isCellLocked(this.getDefaultParent())) ||
									(state != null && !this.isCellLocked(state.cell))) {
									// Avoids accidental inserts on background
									if (state != null || (mxClient.IS_VML && src == this.view.getCanvas()) ||
										(mxClient.IS_SVG && src == this.view.getCanvas().ownerSVGElement)) {
										cell = this.addText(pt.x, pt.y, state);
									}
								}
							}
						}
					}

					mxGraph.prototype.dblClick.call(this, evt, cell);
				}
			};

			/**
			 * Returns a point that specifies the location for inserting cells.
			 */
			Graph.prototype.getInsertPoint = function () {
				var gs = this.getGridSize();
				var dx = this.container.scrollLeft / this.view.scale - this.view.translate.x;
				var dy = this.container.scrollTop / this.view.scale - this.view.translate.y;

				if (this.pageVisible) {
					var layout = this.getPageLayout();
					var page = this.getPageSize();
					dx = Math.max(dx, layout.x * page.width);
					dy = Math.max(dy, layout.y * page.height);
				}

				return new mxPoint(this.snap(dx + gs), this.snap(dy + gs));
			};

			/**
			 * 
			 */
			Graph.prototype.getFreeInsertPoint = function () {
				var view = this.view;
				var bds = this.getGraphBounds();
				var pt = this.getInsertPoint();

				// Places at same x-coord and 2 grid sizes below existing graph
				var x = this.snap(Math.round(Math.max(pt.x, bds.x / view.scale - view.translate.x +
					((bds.width == 0) ? 2 * this.gridSize : 0))));
				var y = this.snap(Math.round(Math.max(pt.y, (bds.y + bds.height) / view.scale - view.translate.y +
					2 * this.gridSize)));

				return new mxPoint(x, y);
			};

			/**
			 * Hook for subclassers to return true if the current insert point was defined
			 * using a mouse hover event.
			 */
			Graph.prototype.isMouseInsertPoint = function () {
				return false;
			};

			/**
			 * Adds a new label at the given position and returns the new cell. State is
			 * an optional edge state to be used as the parent for the label. Vertices
			 * are not allowed currently as states.
			 */
			Graph.prototype.addText = function (x, y, state) {
				// Creates a new edge label with a predefined text
				var label = new mxCell();
				label.value = 'Text';
				label.style = 'text;html=1;resizable=0;points=[];'
				label.geometry = new mxGeometry(0, 0, 0, 0);
				label.vertex = true;

				if (state != null) {
					label.style += 'align=center;verticalAlign=middle;labelBackgroundColor=#ffffff;'
					label.geometry.relative = true;
					label.connectable = false;

					// Resets the relative location stored inside the geometry
					var pt2 = this.view.getRelativePoint(state, x, y);
					label.geometry.x = Math.round(pt2.x * 10000) / 10000;
					label.geometry.y = Math.round(pt2.y);

					// Resets the offset inside the geometry to find the offset from the resulting point
					label.geometry.offset = new mxPoint(0, 0);
					pt2 = this.view.getPoint(state, label.geometry);

					var scale = this.view.scale;
					label.geometry.offset = new mxPoint(Math.round((x - pt2.x) / scale), Math.round((y - pt2.y) / scale));
				}
				else {
					label.style += 'autosize=1;align=left;verticalAlign=top;spacingTop=-4;'

					var tr = this.view.translate;
					label.geometry.width = 40;
					label.geometry.height = 20;
					label.geometry.x = Math.round(x / this.view.scale) - tr.x;
					label.geometry.y = Math.round(y / this.view.scale) - tr.y;
				}

				this.getModel().beginUpdate();
				try {
					this.addCells([label], (state != null) ? state.cell : null);
					this.fireEvent(new mxEventObject('textInserted', 'cells', [label]));
					// Updates size of text after possible change of style via event
					this.autoSizeCell(label);
				}
				finally {
					this.getModel().endUpdate();
				}

				return label;
			};

			/**
			 * 
			 */
			Graph.prototype.getAbsoluteUrl = function (url) {
				if (url != null && this.isRelativeUrl(url)) {
					if (url.charAt(0) == '#') {
						url = this.baseUrl + url;
					}
					else if (url.charAt(0) == '/') {
						url = this.domainUrl + url;
					}
					else {
						url = this.domainPathUrl + url;
					}
				}

				return url;
			};

			/**
			 * Adds a handler for clicking on shapes with links. This replaces all links in labels.
			 */
			Graph.prototype.addClickHandler = function (highlight, beforeClick, onClick) {
				// Replaces links in labels for consistent right-clicks
				var checkLinks = mxUtils.bind(this, function () {
					var links = this.container.getElementsByTagName('a');

					if (links != null) {
						for (var i = 0; i < links.length; i++) {
							var href = this.getAbsoluteUrl(links[i].getAttribute('href'));

							if (href != null) {
								links[i].setAttribute('rel', this.linkRelation);
								links[i].setAttribute('href', href);

								if (beforeClick != null) {
									mxEvent.addGestureListeners(links[i], null, null, beforeClick);
								}
							}
						}
					}
				});

				this.model.addListener(mxEvent.CHANGE, checkLinks);
				checkLinks();

				var cursor = this.container.style.cursor;
				var tol = this.getTolerance();
				var graph = this;

				var mouseListener =
				{
					currentState: null,
					currentLink: null,
					highlight: (highlight != null && highlight != '' && highlight != mxConstants.NONE) ?
						new mxCellHighlight(graph, highlight, 4) : null,
					startX: 0,
					startY: 0,
					scrollLeft: 0,
					scrollTop: 0,
					updateCurrentState: function (me) {
						var tmp = me.sourceState;

						// Gets topmost intersecting cell with link
						if (tmp == null || graph.getLinkForCell(tmp.cell) == null) {
							var cell = graph.getCellAt(me.getGraphX(), me.getGraphY(), null, null, null, function (state, x, y) {
								return graph.getLinkForCell(state.cell) == null;
							});

							tmp = graph.view.getState(cell);
						}

						if (tmp != this.currentState) {
							if (this.currentState != null) {
								this.clear();
							}

							this.currentState = tmp;

							if (this.currentState != null) {
								this.activate(this.currentState);
							}
						}
					},
					mouseDown: function (sender, me) {
						this.startX = me.getGraphX();
						this.startY = me.getGraphY();
						this.scrollLeft = graph.container.scrollLeft;
						this.scrollTop = graph.container.scrollTop;

						if (this.currentLink == null && graph.container.style.overflow == 'auto') {
							graph.container.style.cursor = 'move';
						}

						this.updateCurrentState(me);
					},
					mouseMove: function (sender, me) {
						if (graph.isMouseDown) {
							if (this.currentLink != null) {
								var dx = Math.abs(this.startX - me.getGraphX());
								var dy = Math.abs(this.startY - me.getGraphY());

								if (dx > tol || dy > tol) {
									this.clear();
								}
							}
						}
						else {
							// Checks for parent link
							var linkNode = me.getSource();

							while (linkNode != null && linkNode.nodeName.toLowerCase() != 'a') {
								linkNode = linkNode.parentNode;
							}

							if (linkNode != null) {
								this.clear();
							}
							else {
								if (graph.tooltipHandler != null && this.currentLink != null && this.currentState != null) {
									graph.tooltipHandler.reset(me, true, this.currentState);
								}

								if (this.currentState != null && (me.getState() == this.currentState || me.sourceState == null) &&
									graph.intersects(this.currentState, me.getGraphX(), me.getGraphY())) {
									return;
								}

								this.updateCurrentState(me);
							}
						}
					},
					mouseUp: function (sender, me) {
						var source = me.getSource();
						var evt = me.getEvent();

						// Checks for parent link
						var linkNode = source;

						while (linkNode != null && linkNode.nodeName.toLowerCase() != 'a') {
							linkNode = linkNode.parentNode;
						}

						// Ignores clicks on links and collapse/expand icon
						if (linkNode == null &&
							(((Math.abs(this.scrollLeft - graph.container.scrollLeft) < tol &&
								Math.abs(this.scrollTop - graph.container.scrollTop) < tol) &&
								(me.sourceState == null || !me.isSource(me.sourceState.control))) &&
								(((mxEvent.isLeftMouseButton(evt) || mxEvent.isMiddleMouseButton(evt)) &&
									!mxEvent.isPopupTrigger(evt)) || mxEvent.isTouchEvent(evt)))) {
							if (this.currentLink != null) {
								var blank = graph.isBlankLink(this.currentLink);

								if ((this.currentLink.substring(0, 5) === 'data:' ||
									!blank) && beforeClick != null) {
									beforeClick(evt, this.currentLink);
								}

								if (!mxEvent.isConsumed(evt)) {
									var target = (mxEvent.isMiddleMouseButton(evt)) ? '_blank' :
										((blank) ? graph.linkTarget : '_top');
									graph.openLink(this.currentLink, target);
									me.consume();
								}
							}
							else if (onClick != null && !me.isConsumed() &&
								(Math.abs(this.scrollLeft - graph.container.scrollLeft) < tol &&
									Math.abs(this.scrollTop - graph.container.scrollTop) < tol) &&
								(Math.abs(this.startX - me.getGraphX()) < tol &&
									Math.abs(this.startY - me.getGraphY()) < tol)) {
								onClick(me.getEvent());
							}
						}

						this.clear();
					},
					activate: function (state) {
						this.currentLink = graph.getAbsoluteUrl(graph.getLinkForCell(state.cell));

						if (this.currentLink != null) {
							graph.container.style.cursor = 'pointer';

							if (this.highlight != null) {
								this.highlight.highlight(state);
							}
						}
					},
					clear: function () {
						if (graph.container != null) {
							graph.container.style.cursor = cursor;
						}

						this.currentState = null;
						this.currentLink = null;

						if (this.highlight != null) {
							this.highlight.hide();
						}

						if (graph.tooltipHandler != null) {
							graph.tooltipHandler.hide();
						}
					}
				};

				// Ignores built-in click handling
				graph.click = function (me) { };
				graph.addMouseListener(mouseListener);

				mxEvent.addListener(document, 'mouseleave', function (evt) {
					mouseListener.clear();
				});
			};

			/**
			 * Duplicates the given cells and returns the duplicates.
			 */
			Graph.prototype.duplicateCells = function (cells, append) {
				cells = (cells != null) ? cells : this.getSelectionCells();
				append = (append != null) ? append : true;

				cells = this.model.getTopmostCells(cells);

				var model = this.getModel();
				var s = this.gridSize;
				var select = [];

				model.beginUpdate();
				try {
					var clones = this.cloneCells(cells, false, null, true);

					for (var i = 0; i < cells.length; i++) {
						var parent = model.getParent(cells[i]);
						var child = this.moveCells([clones[i]], s, s, false)[0];
						select.push(child);

						if (append) {
							model.add(parent, clones[i]);
						}
						else {
							// Maintains child index by inserting after clone in parent
							var index = parent.getIndex(cells[i]);
							model.add(parent, clones[i], index + 1);
						}
					}
				}
				finally {
					model.endUpdate();
				}

				return select;
			};

			/**
			 * Inserts the given image at the cursor in a content editable text box using
			 * the insertimage command on the document instance.
			 */
			Graph.prototype.insertImage = function (newValue, w, h) {
				// To find the new image, we create a list of all existing links first
				if (newValue != null) {
					var tmp = this.cellEditor.textarea.getElementsByTagName('img');
					var oldImages = [];

					for (var i = 0; i < tmp.length; i++) {
						oldImages.push(tmp[i]);
					}

					// LATER: Fix inserting link/image in IE8/quirks after focus lost
					document.execCommand('insertimage', false, newValue);

					// Sets size of new image
					var newImages = this.cellEditor.textarea.getElementsByTagName('img');

					if (newImages.length == oldImages.length + 1) {
						// Inverse order in favor of appended images
						for (var i = newImages.length - 1; i >= 0; i--) {
							if (i == 0 || newImages[i] != oldImages[i - 1]) {
								// Workaround for lost styles during undo and redo is using attributes
								newImages[i].setAttribute('width', w);
								newImages[i].setAttribute('height', h);

								break;
							}
						}
					}
				}
			};

			/**
			 * Inserts the given image at the cursor in a content editable text box using
			 * the insertimage command on the document instance.
			 */
			Graph.prototype.insertLink = function (value) {
				if (value.length == 0) {
					document.execCommand('unlink', false);
				}
				else if (mxClient.IS_FF) {
					// Workaround for Firefox that adds a new link and removes
					// the href from the inner link if its parent is a span is
					// to remove all inner links inside the new outer link
					var tmp = this.cellEditor.textarea.getElementsByTagName('a');
					var oldLinks = [];

					for (var i = 0; i < tmp.length; i++) {
						oldLinks.push(tmp[i]);
					}

					document.execCommand('createlink', false, mxUtils.trim(value));

					// Finds the new link element
					var newLinks = this.cellEditor.textarea.getElementsByTagName('a');

					if (newLinks.length == oldLinks.length + 1) {
						// Inverse order in favor of appended links
						for (var i = newLinks.length - 1; i >= 0; i--) {
							if (newLinks[i] != oldLinks[i - 1]) {
								// Removes all inner links from the new link and
								// moves the children to the inner link parent
								var tmp = newLinks[i].getElementsByTagName('a');

								while (tmp.length > 0) {
									var parent = tmp[0].parentNode;

									while (tmp[0].firstChild != null) {
										parent.insertBefore(tmp[0].firstChild, tmp[0]);
									}

									parent.removeChild(tmp[0]);
								}

								break;
							}
						}
					}
				}
				else {
					// LATER: Fix inserting link/image in IE8/quirks after focus lost
					document.execCommand('createlink', false, mxUtils.trim(value));
				}
			};

			/**
			 * 
			 * @param cell
			 * @returns {Boolean}
			 */
			Graph.prototype.isCellResizable = function (cell) {
				var result = mxGraph.prototype.isCellResizable.apply(this, arguments);

				var state = this.view.getState(cell);
				var style = (state != null) ? state.style : this.getCellStyle(cell);

				return result || (mxUtils.getValue(style, mxConstants.STYLE_RESIZABLE, '1') != '0' &&
					style[mxConstants.STYLE_WHITE_SPACE] == 'wrap');
			};

			/**
			 * Function: distributeCells
			 * 
			 * Distribuets the centers of the given cells equally along the available
			 * horizontal or vertical space.
			 * 
			 * Parameters:
			 * 
			 * horizontal - Boolean that specifies the direction of the distribution.
			 * cells - Optional array of <mxCells> to be distributed. Edges are ignored.
			 */
			Graph.prototype.distributeCells = function (horizontal, cells) {
				if (cells == null) {
					cells = this.getSelectionCells();
				}

				if (cells != null && cells.length > 1) {
					var vertices = [];
					var max = null;
					var min = null;

					for (var i = 0; i < cells.length; i++) {
						if (this.getModel().isVertex(cells[i])) {
							var state = this.view.getState(cells[i]);

							if (state != null) {
								var tmp = (horizontal) ? state.getCenterX() : state.getCenterY();
								max = (max != null) ? Math.max(max, tmp) : tmp;
								min = (min != null) ? Math.min(min, tmp) : tmp;

								vertices.push(state);
							}
						}
					}

					if (vertices.length > 2) {
						vertices.sort(function (a, b) {
							return (horizontal) ? a.x - b.x : a.y - b.y;
						});

						var t = this.view.translate;
						var s = this.view.scale;

						min = min / s - ((horizontal) ? t.x : t.y);
						max = max / s - ((horizontal) ? t.x : t.y);

						this.getModel().beginUpdate();
						try {
							var dt = (max - min) / (vertices.length - 1);
							var t0 = min;

							for (var i = 1; i < vertices.length - 1; i++) {
								var pstate = this.view.getState(this.model.getParent(vertices[i].cell));
								var geo = this.getCellGeometry(vertices[i].cell);
								t0 += dt;

								if (geo != null && pstate != null) {
									geo = geo.clone();

									if (horizontal) {
										geo.x = Math.round(t0 - geo.width / 2) - pstate.origin.x;
									}
									else {
										geo.y = Math.round(t0 - geo.height / 2) - pstate.origin.y;
									}

									this.getModel().setGeometry(vertices[i].cell, geo);
								}
							}
						}
						finally {
							this.getModel().endUpdate();
						}
					}
				}

				return cells;
			};

			/**
			 * Adds meta-drag an Mac.
			 * @param evt
			 * @returns
			 */
			Graph.prototype.isCloneEvent = function (evt) {
				return (mxClient.IS_MAC && mxEvent.isMetaDown(evt)) || mxEvent.isControlDown(evt);
			};

			/**
			 * Translates this point by the given vector.
			 * 
			 * @param {number} dx X-coordinate of the translation.
			 * @param {number} dy Y-coordinate of the translation.
			 */
			Graph.prototype.encodeCells = function (cells) {
				var clones = this.cloneCells(cells);

				// Creates a dictionary for fast lookups
				var dict = new mxDictionary();

				for (var i = 0; i < cells.length; i++) {
					dict.put(cells[i], true);
				}

				// Checks for orphaned relative children and makes absolute
				for (var i = 0; i < clones.length; i++) {
					var state = this.view.getState(cells[i]);

					if (state != null) {
						var geo = this.getCellGeometry(clones[i]);

						if (geo != null && geo.relative && !this.model.isEdge(cells[i]) &&
							!dict.get(this.model.getParent(cells[i]))) {
							geo.relative = false;
							geo.x = state.x / state.view.scale - state.view.translate.x;
							geo.y = state.y / state.view.scale - state.view.translate.y;
						}
					}
				}

				var codec = new mxCodec();
				var model = new mxGraphModel();
				var parent = model.getChildAt(model.getRoot(), 0);

				for (var i = 0; i < cells.length; i++) {
					model.add(parent, clones[i]);
				}

				return codec.encode(model);
			};

			/**
			 * Translates this point by the given vector.
			 * 
			 * @param {number} dx X-coordinate of the translation.
			 * @param {number} dy Y-coordinate of the translation.
			 */
			Graph.prototype.createSvgImageExport = function () {
				var exp = new mxImageExport();

				// Adds hyperlinks (experimental)
				exp.getLinkForCellState = mxUtils.bind(this, function (state, canvas) {
					return this.getLinkForCell(state.cell);
				});

				return exp;
			};

			/**
			 * Translates this point by the given vector.
			 * 
			 * @param {number} dx X-coordinate of the translation.
			 * @param {number} dy Y-coordinate of the translation.
			 */
			Graph.prototype.getSvg = function (background, scale, border, nocrop, crisp,
				ignoreSelection, showText, imgExport, linkTarget, hasShadow) {
				//Disable Css Transforms if it is used
				var origUseCssTrans = this.useCssTransforms;

				if (origUseCssTrans) {
					this.useCssTransforms = false;
					this.view.revalidate();
					this.sizeDidChange();
				}

				try {
					scale = (scale != null) ? scale : 1;
					border = (border != null) ? border : 0;
					crisp = (crisp != null) ? crisp : true;
					ignoreSelection = (ignoreSelection != null) ? ignoreSelection : true;
					showText = (showText != null) ? showText : true;

					var bounds = (ignoreSelection || nocrop) ?
						this.getGraphBounds() : this.getBoundingBox(this.getSelectionCells());

					if (bounds == null) {
						throw Error(mxResources.get('drawingEmpty'));
					}

					var vs = this.view.scale;

					// Prepares SVG document that holds the output
					var svgDoc = mxUtils.createXmlDocument();
					var root = (svgDoc.createElementNS != null) ?
						svgDoc.createElementNS(mxConstants.NS_SVG, 'svg') : svgDoc.createElement('svg');

					if (background != null) {
						if (root.style != null) {
							root.style.backgroundColor = background;
						}
						else {
							root.setAttribute('style', 'background-color:' + background);
						}
					}

					if (svgDoc.createElementNS == null) {
						root.setAttribute('xmlns', mxConstants.NS_SVG);
						root.setAttribute('xmlns:xlink', mxConstants.NS_XLINK);
					}
					else {
						// KNOWN: Ignored in IE9-11, adds namespace for each image element instead. No workaround.
						root.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', mxConstants.NS_XLINK);
					}

					var s = scale / vs;
					var w = Math.max(1, Math.ceil(bounds.width * s) + 2 * border) + ((hasShadow) ? 5 : 0);
					var h = Math.max(1, Math.ceil(bounds.height * s) + 2 * border) + ((hasShadow) ? 5 : 0);

					root.setAttribute('version', '1.1');
					root.setAttribute('width', w + 'px');
					root.setAttribute('height', h + 'px');
					root.setAttribute('viewBox', ((crisp) ? '-0.5 -0.5' : '0 0') + ' ' + w + ' ' + h);
					svgDoc.appendChild(root);

					// Renders graph. Offset will be multiplied with state's scale when painting state.
					// TextOffset only seems to affect FF output but used everywhere for consistency.
					var svgCanvas = this.createSvgCanvas(root);
					svgCanvas.foOffset = (crisp) ? -0.5 : 0;
					svgCanvas.textOffset = (crisp) ? -0.5 : 0;
					svgCanvas.imageOffset = (crisp) ? -0.5 : 0;
					svgCanvas.translate(Math.floor((border / scale - bounds.x) / vs),
						Math.floor((border / scale - bounds.y) / vs));

					// Convert HTML entities
					var htmlConverter = document.createElement('textarea');

					// Adds simple text fallback for viewers with no support for foreignObjects
					var createAlternateContent = svgCanvas.createAlternateContent;
					svgCanvas.createAlternateContent = function (fo, x, y, w, h, str, align, valign, wrap, format, overflow, clip, rotation) {
						var s = this.state;

						// Assumes a max character width of 0.2em
						if (this.foAltText != null && (w == 0 || (s.fontSize != 0 && str.length < (w * 5) / s.fontSize))) {
							var alt = this.createElement('text');
							alt.setAttribute('x', Math.round(w / 2));
							alt.setAttribute('y', Math.round((h + s.fontSize) / 2));
							alt.setAttribute('fill', s.fontColor || 'black');
							alt.setAttribute('text-anchor', 'middle');
							alt.setAttribute('font-size', Math.round(s.fontSize) + 'px');
							alt.setAttribute('font-family', s.fontFamily);

							if ((s.fontStyle & mxConstants.FONT_BOLD) == mxConstants.FONT_BOLD) {
								alt.setAttribute('font-weight', 'bold');
							}

							if ((s.fontStyle & mxConstants.FONT_ITALIC) == mxConstants.FONT_ITALIC) {
								alt.setAttribute('font-style', 'italic');
							}

							if ((s.fontStyle & mxConstants.FONT_UNDERLINE) == mxConstants.FONT_UNDERLINE) {
								alt.setAttribute('text-decoration', 'underline');
							}

							try {
								htmlConverter.innerHTML = str;
								alt.textContent = htmlConverter.value;

								return alt;
							}
							catch (e) {
								return createAlternateContent.apply(this, arguments);
							}
						}
						else {
							return createAlternateContent.apply(this, arguments);
						}
					};

					// Paints background image
					var bgImg = this.backgroundImage;

					if (bgImg != null) {
						var s2 = vs / scale;
						var tr = this.view.translate;
						var tmp = new mxRectangle(tr.x * s2, tr.y * s2, bgImg.width * s2, bgImg.height * s2);

						// Checks if visible
						if (mxUtils.intersects(bounds, tmp)) {
							svgCanvas.image(tr.x, tr.y, bgImg.width, bgImg.height, bgImg.src, true);
						}
					}

					svgCanvas.scale(s);
					svgCanvas.textEnabled = showText;

					imgExport = (imgExport != null) ? imgExport : this.createSvgImageExport();
					var imgExportDrawCellState = imgExport.drawCellState;

					// Implements ignoreSelection flag
					imgExport.drawCellState = function (state, canvas) {
						var graph = state.view.graph;
						var selected = graph.isCellSelected(state.cell);
						var parent = graph.model.getParent(state.cell);

						// Checks if parent cell is selected
						while (!ignoreSelection && !selected && parent != null) {
							selected = graph.isCellSelected(parent);
							parent = graph.model.getParent(parent);
						}

						if (ignoreSelection || selected) {
							imgExportDrawCellState.apply(this, arguments);
						}
					};

					imgExport.drawState(this.getView().getState(this.model.root), svgCanvas);
					this.updateSvgLinks(root, linkTarget, true);

					return root;
				}
				finally {
					if (origUseCssTrans) {
						this.useCssTransforms = true;
						this.view.revalidate();
						this.sizeDidChange();
					}
				}
			};

			/**
			 * Hook for creating the canvas used in getSvg.
			 */
			Graph.prototype.updateSvgLinks = function (node, target, removeCustom) {
				var links = node.getElementsByTagName('a');

				for (var i = 0; i < links.length; i++) {
					var href = links[i].getAttribute('href');

					if (href == null) {
						href = links[i].getAttribute('xlink:href');
					}

					if (href != null) {
						if (target != null && /^https?:\/\//.test(href)) {
							links[i].setAttribute('target', target);
						}
						else if (removeCustom && this.isCustomLink(href)) {
							links[i].setAttribute('href', 'javascript:void(0);');
						}
					}
				}
			};

			/**
			 * Hook for creating the canvas used in getSvg.
			 */
			Graph.prototype.createSvgCanvas = function (node) {
				return new mxSvgCanvas2D(node);
			};

			/**
			 * Returns the first ancestor of the current selection with the given name.
			 */
			Graph.prototype.getSelectedElement = function () {
				var node = null;

				if (window.getSelection) {
					var sel = window.getSelection();

					if (sel.getRangeAt && sel.rangeCount) {
						var range = sel.getRangeAt(0);
						node = range.commonAncestorContainer;
					}
				}
				else if (document.selection) {
					node = document.selection.createRange().parentElement();
				}

				return node;
			};

			/**
			 * Returns the first ancestor of the current selection with the given name.
			 */
			Graph.prototype.getParentByName = function (node, name, stopAt) {
				while (node != null) {
					if (node.nodeName == name) {
						return node;
					}

					if (node == stopAt) {
						return null;
					}

					node = node.parentNode;
				}

				return node;
			};

			/**
			 * Selects the given node.
			 */
			Graph.prototype.selectNode = function (node) {
				var sel = null;

				// IE9 and non-IE
				if (window.getSelection) {
					sel = window.getSelection();

					if (sel.getRangeAt && sel.rangeCount) {
						var range = document.createRange();
						range.selectNode(node);
						sel.removeAllRanges();
						sel.addRange(range);
					}
				}
				// IE < 9
				else if ((sel = document.selection) && sel.type != 'Control') {
					var originalRange = sel.createRange();
					originalRange.collapse(true);
					var range = sel.createRange();
					range.setEndPoint('StartToStart', originalRange);
					range.select();
				}
			};

			/**
			 * Inserts a new row into the given table.
			 */
			Graph.prototype.insertRow = function (table, index) {
				var bd = table.tBodies[0];
				var cells = bd.rows[0].cells;
				var cols = 0;

				// Counts columns including colspans
				for (var i = 0; i < cells.length; i++) {
					var colspan = cells[i].getAttribute('colspan');
					cols += (colspan != null) ? parseInt(colspan) : 1;
				}

				var row = bd.insertRow(index);

				for (var i = 0; i < cols; i++) {
					mxUtils.br(row.insertCell(-1));
				}

				return row.cells[0];
			};

			/**
			 * Deletes the given column.
			 */
			Graph.prototype.deleteRow = function (table, index) {
				table.tBodies[0].deleteRow(index);
			};

			/**
			 * Deletes the given column.
			 */
			Graph.prototype.insertColumn = function (table, index) {
				var hd = table.tHead;

				if (hd != null) {
					// TODO: use colIndex
					for (var h = 0; h < hd.rows.length; h++) {
						var th = document.createElement('th');
						hd.rows[h].appendChild(th);
						mxUtils.br(th);
					}
				}

				var bd = table.tBodies[0];

				for (var i = 0; i < bd.rows.length; i++) {
					var cell = bd.rows[i].insertCell(index);
					mxUtils.br(cell);
				}

				return bd.rows[0].cells[(index >= 0) ? index : bd.rows[0].cells.length - 1];
			};

			/**
			 * Deletes the given column.
			 */
			Graph.prototype.deleteColumn = function (table, index) {
				if (index >= 0) {
					var bd = table.tBodies[0];
					var rows = bd.rows;

					for (var i = 0; i < rows.length; i++) {
						if (rows[i].cells.length > index) {
							rows[i].deleteCell(index);
						}
					}
				}
			};

			/**
			 * Inserts the given HTML at the caret position (no undo).
			 */
			Graph.prototype.pasteHtmlAtCaret = function (html) {
				var sel, range;

				// IE9 and non-IE
				if (window.getSelection) {
					sel = window.getSelection();

					if (sel.getRangeAt && sel.rangeCount) {
						range = sel.getRangeAt(0);
						range.deleteContents();

						// Range.createContextualFragment() would be useful here but is
						// only relatively recently standardized and is not supported in
						// some browsers (IE9, for one)
						var el = document.createElement("div");
						el.innerHTML = html;
						var frag = document.createDocumentFragment(), node;

						while ((node = el.firstChild)) {
							lastNode = frag.appendChild(node);
						}

						range.insertNode(frag);
					}
				}
				// IE < 9
				else if ((sel = document.selection) && sel.type != "Control") {
					// FIXME: Does not work if selection is empty
					sel.createRange().pasteHTML(html);
				}
			};

			/**
			 * Creates an anchor elements for handling the given link in the
			 * hint that is shown when the cell is selected.
			 */
			Graph.prototype.createLinkForHint = function (link, label) {
				link = (link != null) ? link : 'javascript:void(0);';

				if (label == null || label.length == 0) {
					if (this.isCustomLink(link)) {
						label = this.getLinkTitle(link);
					}
					else {
						label = link;
					}
				}

				// Helper function to shorten strings
				function short(str, max) {
					if (str.length > max) {
						str = str.substring(0, Math.round(max / 2)) + '...' +
							str.substring(str.length - Math.round(max / 4));
					}

					return str;
				};

				var a = document.createElement('a');
				a.setAttribute('rel', this.linkRelation);
				a.setAttribute('href', this.getAbsoluteUrl(link));
				a.setAttribute('title', short((this.isCustomLink(link)) ?
					this.getLinkTitle(link) : link, 80));

				if (this.linkTarget != null) {
					a.setAttribute('target', this.linkTarget);
				}

				// Adds shortened label to link
				mxUtils.write(a, short(label, 40));

				// Handles custom links
				if (this.isCustomLink(link)) {
					mxEvent.addListener(a, 'click', mxUtils.bind(this, function (evt) {
						this.customLinkClicked(link);
						mxEvent.consume(evt);
					}));
				}

				return a;
			};

			/**
			 * Customized graph for touch devices.
			 */
			Graph.prototype.initTouch = function () {
				// Disables new connections via "hotspot"
				this.connectionHandler.marker.isEnabled = function () {
					return this.graph.connectionHandler.first != null;
				};

				// Hides menu when editing starts
				this.addListener(mxEvent.START_EDITING, function (sender, evt) {
					this.popupMenuHandler.hideMenu();
				});

				// Adds custom hit detection if native hit detection found no cell
				var graphUpdateMouseEvent = this.updateMouseEvent;
				this.updateMouseEvent = function (me) {
					me = graphUpdateMouseEvent.apply(this, arguments);

					if (mxEvent.isTouchEvent(me.getEvent()) && me.getState() == null) {
						var cell = this.getCellAt(me.graphX, me.graphY);

						if (cell != null && this.isSwimlane(cell) && this.hitsSwimlaneContent(cell, me.graphX, me.graphY)) {
							cell = null;
						}
						else {
							me.state = this.view.getState(cell);

							if (me.state != null && me.state.shape != null) {
								this.container.style.cursor = me.state.shape.node.style.cursor;
							}
						}
					}

					if (me.getState() == null && this.isEnabled()) {
						this.container.style.cursor = 'default';
					}

					return me;
				};

				// Context menu trigger implementation depending on current selection state
				// combined with support for normal popup trigger.
				var cellSelected = false;
				var selectionEmpty = false;
				var menuShowing = false;

				var oldFireMouseEvent = this.fireMouseEvent;

				this.fireMouseEvent = function (evtName, me, sender) {
					if (evtName == mxEvent.MOUSE_DOWN) {
						// For hit detection on edges
						me = this.updateMouseEvent(me);

						cellSelected = this.isCellSelected(me.getCell());
						selectionEmpty = this.isSelectionEmpty();
						menuShowing = this.popupMenuHandler.isMenuShowing();
					}

					oldFireMouseEvent.apply(this, arguments);
				};

				// Shows popup menu if cell was selected or selection was empty and background was clicked
				// FIXME: Conflicts with mxPopupMenuHandler.prototype.getCellForPopupEvent in Editor.js by
				// selecting parent for selected children in groups before this check can be made.
				this.popupMenuHandler.mouseUp = mxUtils.bind(this, function (sender, me) {
					this.popupMenuHandler.popupTrigger = !this.isEditing() && this.isEnabled() &&
						(me.getState() == null || !me.isSource(me.getState().control)) &&
						(this.popupMenuHandler.popupTrigger || (!menuShowing && !mxEvent.isMouseEvent(me.getEvent()) &&
							((selectionEmpty && me.getCell() == null && this.isSelectionEmpty()) ||
								(cellSelected && this.isCellSelected(me.getCell())))));
					mxPopupMenuHandler.prototype.mouseUp.apply(this.popupMenuHandler, arguments);
				});
			};

			/**
			 * HTML in-place editor
			 */
			mxCellEditor.prototype.isContentEditing = function () {
				var state = this.graph.view.getState(this.editingCell);

				return state != null && state.style['html'] == 1;
			};

			/**
			 * Creates the keyboard event handler for the current graph and history.
			 */
			mxCellEditor.prototype.saveSelection = function () {
				if (window.getSelection) {
					var sel = window.getSelection();

					if (sel.getRangeAt && sel.rangeCount) {
						var ranges = [];

						for (var i = 0, len = sel.rangeCount; i < len; ++i) {
							ranges.push(sel.getRangeAt(i));
						}

						return ranges;
					}
				}
				else if (document.selection && document.selection.createRange) {
					return document.selection.createRange();
				}

				return null;
			};

			/**
			 * Creates the keyboard event handler for the current graph and history.
			 */
			mxCellEditor.prototype.restoreSelection = function (savedSel) {
				try {
					if (savedSel) {
						if (window.getSelection) {
							sel = window.getSelection();
							sel.removeAllRanges();

							for (var i = 0, len = savedSel.length; i < len; ++i) {
								sel.addRange(savedSel[i]);
							}
						}
						else if (document.selection && savedSel.select) {
							savedSel.select();
						}
					}
				}
				catch (e) {
					// ignore
				}
			};

			/**
			 * Handling of special nl2Br style for not converting newlines to breaks in HTML labels.
			 * NOTE: Since it's easier to set this when the label is created we assume that it does
			 * not change during the lifetime of the mxText instance.
			 */
			var mxCellRendererInitializeLabel = mxCellRenderer.prototype.initializeLabel;
			mxCellRenderer.prototype.initializeLabel = function (state) {
				if (state.text != null) {
					state.text.replaceLinefeeds = mxUtils.getValue(state.style, 'nl2Br', '1') != '0';
				}

				mxCellRendererInitializeLabel.apply(this, arguments);
			};

			var mxConstraintHandlerUpdate = mxConstraintHandler.prototype.update;
			mxConstraintHandler.prototype.update = function (me, source) {
				if (this.isKeepFocusEvent(me) || !mxEvent.isAltDown(me.getEvent())) {
					mxConstraintHandlerUpdate.apply(this, arguments);
				}
				else {
					this.reset();
				}
			};

			/**
			 * No dashed shapes.
			 */
			mxGuide.prototype.createGuideShape = function (horizontal) {
				var guide = new mxPolyline([], mxConstants.GUIDE_COLOR, mxConstants.GUIDE_STROKEWIDTH);

				return guide;
			};

			/**
			 * HTML in-place editor
			 */
			mxCellEditor.prototype.escapeCancelsEditing = false;

			var mxCellEditorStartEditing = mxCellEditor.prototype.startEditing;
			mxCellEditor.prototype.startEditing = function (cell, trigger) {
				mxCellEditorStartEditing.apply(this, arguments);

				// Overrides class in case of HTML content to add
				// dashed borders for divs and table cells
				var state = this.graph.view.getState(cell);

				if (state != null && state.style['html'] == 1) {
					this.textarea.className = 'mxCellEditor geContentEditable';
				}
				else {
					this.textarea.className = 'mxCellEditor mxPlainTextEditor';
				}

				// Toggles markup vs wysiwyg mode
				this.codeViewMode = false;

				// Stores current selection range when switching between markup and code
				this.switchSelectionState = null;

				// Selects editing cell
				this.graph.setSelectionCell(cell);

				// Enables focus outline for edges and edge labels
				var parent = this.graph.getModel().getParent(cell);
				var geo = this.graph.getCellGeometry(cell);

				if ((this.graph.getModel().isEdge(parent) && geo != null && geo.relative) ||
					this.graph.getModel().isEdge(cell)) {
					// Quirks does not support outline at all so use border instead
					if (mxClient.IS_QUIRKS) {
						this.textarea.style.border = 'gray dotted 1px';
					}
					// IE>8 and FF on Windows uses outline default of none
					else if (mxClient.IS_IE || mxClient.IS_IE11 || (mxClient.IS_FF && mxClient.IS_WIN)) {
						this.textarea.style.outline = 'gray dotted 1px';
					}
					else {
						this.textarea.style.outline = '';
					}
				}
				else if (mxClient.IS_QUIRKS) {
					this.textarea.style.outline = 'none';
					this.textarea.style.border = '';
				}
			}

			/**
			 * HTML in-place editor
			 */
			var cellEditorInstallListeners = mxCellEditor.prototype.installListeners;
			mxCellEditor.prototype.installListeners = function (elt) {
				cellEditorInstallListeners.apply(this, arguments);

				// Adds a reference from the clone to the original node, recursively
				function reference(node, clone) {
					clone.originalNode = node;

					node = node.firstChild;
					var child = clone.firstChild;

					while (node != null && child != null) {
						reference(node, child);
						node = node.nextSibling;
						child = child.nextSibling;
					}

					return clone;
				};

				// Checks the given node for new nodes, recursively
				function checkNode(node, clone) {
					if (node != null) {
						if (clone.originalNode != node) {
							cleanNode(node);
						}
						else {
							node = node.firstChild;
							clone = clone.firstChild;

							while (node != null) {
								var nextNode = node.nextSibling;

								if (clone == null) {
									cleanNode(node);
								}
								else {
									checkNode(node, clone);
									clone = clone.nextSibling;
								}

								node = nextNode;
							}
						}
					}
				};

				// Removes unused DOM nodes and attributes, recursively
				function cleanNode(node) {
					var child = node.firstChild;

					while (child != null) {
						var next = child.nextSibling;
						cleanNode(child);
						child = next;
					}

					if ((node.nodeType != 1 || (node.nodeName !== 'BR' && node.firstChild == null)) &&
						(node.nodeType != 3 || mxUtils.trim(mxUtils.getTextContent(node)).length == 0)) {
						node.parentNode.removeChild(node);
					}
					else {
						// Removes linefeeds
						if (node.nodeType == 3) {
							mxUtils.setTextContent(node, mxUtils.getTextContent(node).replace(/\n|\r/g, ''));
						}

						// Removes CSS classes and styles (for Word and Excel)
						if (node.nodeType == 1) {
							node.removeAttribute('style');
							node.removeAttribute('class');
							node.removeAttribute('width');
							node.removeAttribute('cellpadding');
							node.removeAttribute('cellspacing');
							node.removeAttribute('border');
						}
					}
				};

				// Handles paste from Word, Excel etc by removing styles, classnames and unused nodes
				// LATER: Fix undo/redo for paste
				if (!mxClient.IS_QUIRKS && document.documentMode !== 7 && document.documentMode !== 8) {
					mxEvent.addListener(this.textarea, 'paste', mxUtils.bind(this, function (evt) {
						var clone = reference(this.textarea, this.textarea.cloneNode(true));

						window.setTimeout(mxUtils.bind(this, function () {
							checkNode(this.textarea, clone);
						}), 0);
					}));
				}
			};

			mxCellEditor.prototype.toggleViewMode = function () {
				var state = this.graph.view.getState(this.editingCell);
				var nl2Br = state != null && mxUtils.getValue(state.style, 'nl2Br', '1') != '0';
				var tmp = this.saveSelection();

				if (!this.codeViewMode) {
					// Clears the initial empty label on the first keystroke
					if (this.clearOnChange && this.textarea.innerHTML == this.getEmptyLabelText()) {
						this.clearOnChange = false;
						this.textarea.innerHTML = '';
					}

					// Removes newlines from HTML and converts breaks to newlines
					// to match the HTML output in plain text
					var content = mxUtils.htmlEntities(this.textarea.innerHTML);

					// Workaround for trailing line breaks being ignored in the editor
					if (!mxClient.IS_QUIRKS && document.documentMode != 8) {
						content = mxUtils.replaceTrailingNewlines(content, '<div><br></div>');
					}

					content = this.graph.sanitizeHtml((nl2Br) ? content.replace(/\n/g, '').replace(/&lt;br\s*.?&gt;/g, '<br>') : content, true);
					this.textarea.className = 'mxCellEditor mxPlainTextEditor';

					var size = mxConstants.DEFAULT_FONTSIZE;

					this.textarea.style.lineHeight = (mxConstants.ABSOLUTE_LINE_HEIGHT) ? Math.round(size * mxConstants.LINE_HEIGHT) + 'px' : mxConstants.LINE_HEIGHT;
					this.textarea.style.fontSize = Math.round(size) + 'px';
					this.textarea.style.textDecoration = '';
					this.textarea.style.fontWeight = 'normal';
					this.textarea.style.fontStyle = '';
					this.textarea.style.fontFamily = mxConstants.DEFAULT_FONTFAMILY;
					this.textarea.style.textAlign = 'left';

					// Adds padding to make cursor visible with borders
					this.textarea.style.padding = '2px';

					if (this.textarea.innerHTML != content) {
						this.textarea.innerHTML = content;
					}

					this.codeViewMode = true;
				}
				else {
					var content = mxUtils.extractTextWithWhitespace(this.textarea.childNodes);

					// Strips trailing line break
					if (content.length > 0 && content.charAt(content.length - 1) == '\n') {
						content = content.substring(0, content.length - 1);
					}

					content = this.graph.sanitizeHtml((nl2Br) ? content.replace(/\n/g, '<br/>') : content, true)
					this.textarea.className = 'mxCellEditor geContentEditable';

					var size = mxUtils.getValue(state.style, mxConstants.STYLE_FONTSIZE, mxConstants.DEFAULT_FONTSIZE);
					var family = mxUtils.getValue(state.style, mxConstants.STYLE_FONTFAMILY, mxConstants.DEFAULT_FONTFAMILY);
					var align = mxUtils.getValue(state.style, mxConstants.STYLE_ALIGN, mxConstants.ALIGN_LEFT);
					var bold = (mxUtils.getValue(state.style, mxConstants.STYLE_FONTSTYLE, 0) &
						mxConstants.FONT_BOLD) == mxConstants.FONT_BOLD;
					var italic = (mxUtils.getValue(state.style, mxConstants.STYLE_FONTSTYLE, 0) &
						mxConstants.FONT_ITALIC) == mxConstants.FONT_ITALIC;
					var uline = (mxUtils.getValue(state.style, mxConstants.STYLE_FONTSTYLE, 0) &
						mxConstants.FONT_UNDERLINE) == mxConstants.FONT_UNDERLINE;

					this.textarea.style.lineHeight = (mxConstants.ABSOLUTE_LINE_HEIGHT) ? Math.round(size * mxConstants.LINE_HEIGHT) + 'px' : mxConstants.LINE_HEIGHT;
					this.textarea.style.fontSize = Math.round(size) + 'px';
					this.textarea.style.textDecoration = (uline) ? 'underline' : '';
					this.textarea.style.fontWeight = (bold) ? 'bold' : 'normal';
					this.textarea.style.fontStyle = (italic) ? 'italic' : '';
					this.textarea.style.fontFamily = family;
					this.textarea.style.textAlign = align;
					this.textarea.style.padding = '0px';

					if (this.textarea.innerHTML != content) {
						this.textarea.innerHTML = content;

						if (this.textarea.innerHTML.length == 0) {
							this.textarea.innerHTML = this.getEmptyLabelText();
							this.clearOnChange = this.textarea.innerHTML.length > 0;
						}
					}

					this.codeViewMode = false;
				}

				this.textarea.focus();

				if (this.switchSelectionState != null) {
					this.restoreSelection(this.switchSelectionState);
				}

				this.switchSelectionState = tmp;
				this.resize();
			};

			var mxCellEditorResize = mxCellEditor.prototype.resize;
			mxCellEditor.prototype.resize = function (state, trigger) {
				if (this.textarea != null) {
					var state = this.graph.getView().getState(this.editingCell);

					if (this.codeViewMode && state != null) {
						var scale = state.view.scale;
						this.bounds = mxRectangle.fromRectangle(state);

						// General placement of code editor if cell has no size
						// LATER: Fix HTML editor bounds for edge labels
						if (this.bounds.width == 0 && this.bounds.height == 0) {
							this.bounds.width = 160 * scale;
							this.bounds.height = 60 * scale;

							var m = (state.text != null) ? state.text.margin : null;

							if (m == null) {
								m = mxUtils.getAlignmentAsPoint(mxUtils.getValue(state.style, mxConstants.STYLE_ALIGN, mxConstants.ALIGN_CENTER),
									mxUtils.getValue(state.style, mxConstants.STYLE_VERTICAL_ALIGN, mxConstants.ALIGN_MIDDLE));
							}

							this.bounds.x += m.x * this.bounds.width;
							this.bounds.y += m.y * this.bounds.height;
						}

						this.textarea.style.width = Math.round((this.bounds.width - 4) / scale) + 'px';
						this.textarea.style.height = Math.round((this.bounds.height - 4) / scale) + 'px';
						this.textarea.style.overflow = 'auto';

						// Adds scrollbar offset if visible
						if (this.textarea.clientHeight < this.textarea.offsetHeight) {
							this.textarea.style.height = Math.round((this.bounds.height / scale)) + (this.textarea.offsetHeight - this.textarea.clientHeight) + 'px';
							this.bounds.height = parseInt(this.textarea.style.height) * scale;
						}

						if (this.textarea.clientWidth < this.textarea.offsetWidth) {
							this.textarea.style.width = Math.round((this.bounds.width / scale)) + (this.textarea.offsetWidth - this.textarea.clientWidth) + 'px';
							this.bounds.width = parseInt(this.textarea.style.width) * scale;
						}

						this.textarea.style.left = Math.round(this.bounds.x) + 'px';
						this.textarea.style.top = Math.round(this.bounds.y) + 'px';

						if (mxClient.IS_VML) {
							this.textarea.style.zoom = scale;
						}
						else {
							mxUtils.setPrefixedStyle(this.textarea.style, 'transform', 'scale(' + scale + ',' + scale + ')');
						}
					}
					else {
						this.textarea.style.height = '';
						this.textarea.style.overflow = '';
						mxCellEditorResize.apply(this, arguments);
					}
				}
			};

			var mxCellEditorGetInitialValue = mxCellEditor.prototype.getInitialValue;
			mxCellEditor.prototype.getInitialValue = function (state, trigger) {
				if (mxUtils.getValue(state.style, 'html', '0') == '0') {
					return mxCellEditorGetInitialValue.apply(this, arguments);
				}
				else {
					var result = this.graph.getEditingValue(state.cell, trigger)

					if (mxUtils.getValue(state.style, 'nl2Br', '1') == '1') {
						result = result.replace(/\n/g, '<br/>');
					}

					result = this.graph.sanitizeHtml(result, true);

					return result;
				}
			};

			var mxCellEditorGetCurrentValue = mxCellEditor.prototype.getCurrentValue;
			mxCellEditor.prototype.getCurrentValue = function (state) {
				if (mxUtils.getValue(state.style, 'html', '0') == '0') {
					return mxCellEditorGetCurrentValue.apply(this, arguments);
				}
				else {
					var result = this.graph.sanitizeHtml(this.textarea.innerHTML, true);

					if (mxUtils.getValue(state.style, 'nl2Br', '1') == '1') {
						result = result.replace(/\r\n/g, '<br/>').replace(/\n/g, '<br/>');
					}
					else {
						result = result.replace(/\r\n/g, '').replace(/\n/g, '');
					}

					return result;
				}
			};

			var mxCellEditorStopEditing = mxCellEditor.prototype.stopEditing;
			mxCellEditor.prototype.stopEditing = function (cancel) {
				// Restores default view mode before applying value
				if (this.codeViewMode) {
					this.toggleViewMode();
				}

				mxCellEditorStopEditing.apply(this, arguments);

				// Tries to move focus back to container after editing if possible
				this.focusContainer();
			};

			mxCellEditor.prototype.focusContainer = function () {
				try {
					this.graph.container.focus();
				}
				catch (e) {
					// ignore
				}
			};

			var mxCellEditorApplyValue = mxCellEditor.prototype.applyValue;
			mxCellEditor.prototype.applyValue = function (state, value) {
				// Removes empty relative child labels in edges
				this.graph.getModel().beginUpdate();

				try {
					mxCellEditorApplyValue.apply(this, arguments);

					if (this.graph.isCellDeletable(state.cell) && this.graph.model.getChildCount(state.cell) == 0) {
						var stroke = mxUtils.getValue(state.style, mxConstants.STYLE_STROKECOLOR, mxConstants.NONE);
						var fill = mxUtils.getValue(state.style, mxConstants.STYLE_FILLCOLOR, mxConstants.NONE);

						if (value == '' && stroke == mxConstants.NONE && fill == mxConstants.NONE) {
							this.graph.removeCells([state.cell], false);
						}
					}
				}
				finally {
					this.graph.getModel().endUpdate();
				}
			};

			/**
			 * Returns the background color to be used for the editing box. This returns
			 * the label background for edge labels and null for all other cases.
			 */
			mxCellEditor.prototype.getBackgroundColor = function (state) {
				var color = null;

				if (this.graph.getModel().isEdge(state.cell) || this.graph.getModel().isEdge(this.graph.getModel().getParent(state.cell))) {
					var color = mxUtils.getValue(state.style, mxConstants.STYLE_LABEL_BACKGROUNDCOLOR, null);

					if (color == mxConstants.NONE) {
						color = null;
					}
				}

				return color;
			};

			mxCellEditor.prototype.getMinimumSize = function (state) {
				var scale = this.graph.getView().scale;

				return new mxRectangle(0, 0, (state.text == null) ? 30 : state.text.size * scale + 20, 30);
			};

			// Hold alt to ignore drop target
			var mxGraphHandlerMoveCells = mxGraphHandler.prototype.moveCells;

			mxGraphHandler.prototype.moveCells = function (cells, dx, dy, clone, target, evt) {
				if (mxEvent.isAltDown(evt)) {
					target = null;
				}

				mxGraphHandlerMoveCells.apply(this, arguments);
			};

			/**
			 * Hints on handlers
			 */
			function createHint() {
				var hint = document.createElement('div');
				hint.className = 'geHint';
				hint.style.whiteSpace = 'nowrap';
				hint.style.position = 'absolute';

				return hint;
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxGraphHandler.prototype.updateHint = function (me) {
				if (this.shape != null) {
					if (this.hint == null) {
						this.hint = createHint();
						this.graph.container.appendChild(this.hint);
					}

					var t = this.graph.view.translate;
					var s = this.graph.view.scale;
					var x = this.roundLength((this.bounds.x + this.currentDx) / s - t.x);
					var y = this.roundLength((this.bounds.y + this.currentDy) / s - t.y);

					this.hint.innerHTML = x + ', ' + y;

					this.hint.style.left = (this.shape.bounds.x + Math.round((this.shape.bounds.width - this.hint.clientWidth) / 2)) + 'px';
					this.hint.style.top = (this.shape.bounds.y + this.shape.bounds.height + 12) + 'px';
				}
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxGraphHandler.prototype.removeHint = function () {
				if (this.hint != null) {
					this.hint.parentNode.removeChild(this.hint);
					this.hint = null;
				}
			};

			/**
			 * Enables recursive resize for groups.
			 */
			mxVertexHandler.prototype.isRecursiveResize = function (state, me) {
				return !this.graph.isSwimlane(state.cell) && this.graph.model.getChildCount(state.cell) > 0 &&
					!mxEvent.isControlDown(me.getEvent()) && !this.graph.isCellCollapsed(state.cell) &&
					mxUtils.getValue(state.style, 'recursiveResize', '1') == '1' &&
					mxUtils.getValue(state.style, 'childLayout', null) == null;
			};

			/**
			 * Enables centered resize events.
			 */
			mxVertexHandler.prototype.isCenteredEvent = function (state, me) {
				return (!(!this.graph.isSwimlane(state.cell) && this.graph.model.getChildCount(state.cell) > 0 &&
					!this.graph.isCellCollapsed(state.cell) &&
					mxUtils.getValue(state.style, 'recursiveResize', '1') == '1' &&
					mxUtils.getValue(state.style, 'childLayout', null) == null) &&
					mxEvent.isControlDown(me.getEvent())) ||
					mxEvent.isMetaDown(me.getEvent());
			};

			var vertexHandlerGetHandlePadding = mxVertexHandler.prototype.getHandlePadding;
			mxVertexHandler.prototype.getHandlePadding = function () {
				var result = new mxPoint(0, 0);
				var tol = this.tolerance;

				if (this.graph.cellEditor.getEditingCell() == this.state.cell &&
					this.sizers != null && this.sizers.length > 0 && this.sizers[0] != null) {
					tol /= 2;

					result.x = this.sizers[0].bounds.width + tol;
					result.y = this.sizers[0].bounds.height + tol;
				}
				else {
					result = vertexHandlerGetHandlePadding.apply(this, arguments);
				}

				return result;
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxVertexHandler.prototype.updateHint = function (me) {
				if (this.index != mxEvent.LABEL_HANDLE) {
					if (this.hint == null) {
						this.hint = createHint();
						this.state.view.graph.container.appendChild(this.hint);
					}

					if (this.index == mxEvent.ROTATION_HANDLE) {
						this.hint.innerHTML = this.currentAlpha + '&deg;';
					}
					else {
						var s = this.state.view.scale;
						this.hint.innerHTML = this.roundLength(this.bounds.width / s) + ' x ' + this.roundLength(this.bounds.height / s);
					}

					var rot = (this.currentAlpha != null) ? this.currentAlpha : this.state.style[mxConstants.STYLE_ROTATION] || '0';
					var bb = mxUtils.getBoundingBox(this.bounds, rot);

					if (bb == null) {
						bb = this.bounds;
					}

					this.hint.style.left = bb.x + Math.round((bb.width - this.hint.clientWidth) / 2) + 'px';
					this.hint.style.top = (bb.y + bb.height + 12) + 'px';

					if (this.linkHint != null) {
						this.linkHint.style.display = 'none';
					}
				}
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxVertexHandler.prototype.removeHint = function () {
				mxGraphHandler.prototype.removeHint.apply(this, arguments);

				if (this.linkHint != null) {
					this.linkHint.style.display = '';
				}
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxEdgeHandler.prototype.updateHint = function (me, point) {
				if (this.hint == null) {
					this.hint = createHint();
					this.state.view.graph.container.appendChild(this.hint);
				}

				var t = this.graph.view.translate;
				var s = this.graph.view.scale;
				var x = this.roundLength(point.x / s - t.x);
				var y = this.roundLength(point.y / s - t.y);

				this.hint.innerHTML = x + ', ' + y;
				this.hint.style.visibility = 'visible';

				if (this.isSource || this.isTarget) {
					if (this.constraintHandler.currentConstraint != null &&
						this.constraintHandler.currentFocus != null) {
						var pt = this.constraintHandler.currentConstraint.point;
						this.hint.innerHTML = '[' + Math.round(pt.x * 100) + '%, ' + Math.round(pt.y * 100) + '%]';
					}
					else if (this.marker.hasValidState()) {
						this.hint.style.visibility = 'hidden';
					}
				}

				this.hint.style.left = Math.round(me.getGraphX() - this.hint.clientWidth / 2) + 'px';
				this.hint.style.top = (Math.max(me.getGraphY(), point.y) + this.state.view.graph.gridSize) + 'px';

				if (this.linkHint != null) {
					this.linkHint.style.display = 'none';
				}
			};

			/**
			 * Updates the hint for the current operation.
			 */
			mxEdgeHandler.prototype.removeHint = mxVertexHandler.prototype.removeHint;

			/**
			 * Defines the handles for the UI. Uses data-URIs to speed-up loading time where supported.
			 */
			// TODO: Increase handle padding
			HoverIcons.prototype.mainHandle = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/handle-main.png', 17, 17) :
				Graph.createSvgImage(18, 18, '<circle cx="9" cy="9" r="5" stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '" stroke-width="1"/>');
			HoverIcons.prototype.secondaryHandle = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/handle-secondary.png', 17, 17) :
				Graph.createSvgImage(16, 16, '<path d="m 8 3 L 13 8 L 8 13 L 3 8 z" stroke="#fff" fill="#fca000"/>');
			HoverIcons.prototype.fixedHandle = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/handle-fixed.png', 17, 17) :
				Graph.createSvgImage(18, 18, '<circle cx="9" cy="9" r="5" stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '" stroke-width="1"/><path d="m 7 7 L 11 11 M 7 11 L 11 7" stroke="#fff"/>');
			HoverIcons.prototype.terminalHandle = (!mxClient.IS_SVG) ? new mxImage(IMAGE_PATH + '/handle-terminal.png', 17, 17) :
				Graph.createSvgImage(18, 18, '<circle cx="9" cy="9" r="5" stroke="#fff" fill="' + HoverIcons.prototype.arrowFill + '" stroke-width="1"/><circle cx="9" cy="9" r="2" stroke="#fff" fill="transparent"/>');
			HoverIcons.prototype.rotationHandle = new mxImage((mxClient.IS_SVG) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAVCAYAAACkCdXRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOkc5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAqqBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlLOW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZarnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUFK4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1+1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuWTPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO/PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7JvttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTradox7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nuer21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72Xcn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT+R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAgY0hSTQAAeiUAAICDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAAA6ZJREFUeNqM001IY1cUB/D/fYmm2sbR2lC1zYlgoRG6MpEyBlpxM9iFIGKFIm3s0lCKjOByhCLZCFqLBF1YFVJdSRbdFHRhBbULtRuFVBTzYRpJgo2mY5OX5N9Fo2TG+eiFA/dd3vvd8+65ByTxshARTdf1JySp6/oTEdFe9T5eg5lIcnBwkCSZyWS+exX40oyur68/KxaLf5Okw+H4X+A9JBaLfUySZ2dnnJqaosPhIAACeC34DJRKpb7IZrMcHx+nwWCgUopGo/EOKwf9fn/1CzERUevr6+9ls1mOjIwQAH0+H4PBIKPR6D2ofAQCgToRUeVYJUkuLy8TANfW1kiS8/PzCy84Mw4MDBAAZ2dnmc/nub+/X0MSEBF1cHDwMJVKsaGhgV6vl+l0mqOjo1+KyKfl1dze3l4NBoM/PZ+diFSLiIKIGBOJxA9bW1sEwNXVVSaTyQMRaRaRxrOzs+9J8ujoaE5EPhQRq67rcZ/PRwD0+/3Udf03EdEgIqZisZibnJykwWDg4eEhd3Z2xkXELCJvPpdBrYjUiEhL+Xo4HH4sIhUaAKNSqiIcDsNkMqG+vh6RSOQQQM7tdhsAQCkFAHC73UUATxcWFqypVApmsxnDw8OwWq2TADQNgAYAFosF+XweyWQSdru9BUBxcXFRB/4rEgDcPouIIx6P4+bmBi0tLSCpAzBqAIqnp6c/dnZ2IpfLYXNzE62traMADACKNputpr+/v8lms9UAKAAwiMjXe3t7KBQKqKurQy6Xi6K0i2l6evpROp1mbW0t29vbGY/Hb8/IVIqq2zlJXl1dsaOjg2azmefn5wwEAl+JSBVExCgi75PkzMwMlVJsbGxkIpFgPp8PX15ePopEIs3JZPITXdf/iEajbGpqolKKExMT1HWdHo/nIxGpgIgoEXnQ3d39kCTHxsYIgC6Xi3NzcwyHw8xkMozFYlxaWmJbWxuVUuzt7WUul6PX6/1cRN4WEe2uA0SkaWVl5XGpRVhdXU0A1DSNlZWVdz3qdDrZ09PDWCzG4+Pjn0XEWvp9KJKw2WwKwBsA3gHQHAqFfr24uMDGxgZ2d3cRiUQAAHa7HU6nE319fTg5Ofmlq6vrGwB/AngaCoWK6rbsNptNA1AJoA7Aux6Pp3NoaMhjsVg+QNmIRqO/u1yubwFEASRKUAEA7rASqABUAKgC8KAUb5XWCOAfAFcA/gJwDSB7C93DylCtdM8qABhLc5TumV6KQigUeubjfwcAHkQJ94ndWeYAAAAASUVORK5CYII=' :
				IMAGE_PATH + '/handle-rotate.png', 19, 21);

			if (mxClient.IS_SVG) {
				mxConstraintHandler.prototype.pointImage = Graph.createSvgImage(5, 5, '<path d="m 0 0 L 5 5 M 0 5 L 5 0" stroke="' + HoverIcons.prototype.arrowFill + '"/>');
			}

			mxVertexHandler.prototype.handleImage = HoverIcons.prototype.mainHandle;
			mxVertexHandler.prototype.secondaryHandleImage = HoverIcons.prototype.secondaryHandle;
			mxEdgeHandler.prototype.handleImage = HoverIcons.prototype.mainHandle;
			mxEdgeHandler.prototype.terminalHandleImage = HoverIcons.prototype.terminalHandle;
			mxEdgeHandler.prototype.fixedHandleImage = HoverIcons.prototype.fixedHandle;
			mxEdgeHandler.prototype.labelHandleImage = HoverIcons.prototype.secondaryHandle;
			mxOutline.prototype.sizerImage = HoverIcons.prototype.mainHandle;

			if (window.Sidebar != null) {
				Sidebar.prototype.triangleUp = HoverIcons.prototype.triangleUp;
				Sidebar.prototype.triangleRight = HoverIcons.prototype.triangleRight;
				Sidebar.prototype.triangleDown = HoverIcons.prototype.triangleDown;
				Sidebar.prototype.triangleLeft = HoverIcons.prototype.triangleLeft;
				Sidebar.prototype.refreshTarget = HoverIcons.prototype.refreshTarget;
				Sidebar.prototype.roundDrop = HoverIcons.prototype.roundDrop;
			}

			// Pre-fetches images (only needed for non data-uris)
			if (!mxClient.IS_SVG) {
				new Image().src = HoverIcons.prototype.mainHandle.src;
				new Image().src = HoverIcons.prototype.fixedHandle.src;
				new Image().src = HoverIcons.prototype.terminalHandle.src;
				new Image().src = HoverIcons.prototype.secondaryHandle.src;
				new Image().src = HoverIcons.prototype.rotationHandle.src;

				new Image().src = HoverIcons.prototype.triangleUp.src;
				new Image().src = HoverIcons.prototype.triangleRight.src;
				new Image().src = HoverIcons.prototype.triangleDown.src;
				new Image().src = HoverIcons.prototype.triangleLeft.src;
				new Image().src = HoverIcons.prototype.refreshTarget.src;
				new Image().src = HoverIcons.prototype.roundDrop.src;
			}

			// Adds rotation handle and live preview
			mxVertexHandler.prototype.rotationEnabled = true;
			mxVertexHandler.prototype.manageSizers = true;
			mxVertexHandler.prototype.livePreview = true;

			// Increases default rubberband opacity (default is 20)
			mxRubberband.prototype.defaultOpacity = 30;

			// Enables connections along the outline, virtual waypoints, parent highlight etc
			mxConnectionHandler.prototype.outlineConnect = true;
			mxCellHighlight.prototype.keepOnTop = true;
			mxVertexHandler.prototype.parentHighlightEnabled = true;
			mxVertexHandler.prototype.rotationHandleVSpacing = -20;

			mxEdgeHandler.prototype.parentHighlightEnabled = true;
			mxEdgeHandler.prototype.dblClickRemoveEnabled = true;
			mxEdgeHandler.prototype.straightRemoveEnabled = true;
			mxEdgeHandler.prototype.virtualBendsEnabled = true;
			mxEdgeHandler.prototype.mergeRemoveEnabled = true;
			mxEdgeHandler.prototype.manageLabelHandle = true;
			mxEdgeHandler.prototype.outlineConnect = true;

			// Disables adding waypoints if shift is pressed
			mxEdgeHandler.prototype.isAddVirtualBendEvent = function (me) {
				return !mxEvent.isShiftDown(me.getEvent());
			};

			// Disables custom handles if shift is pressed
			mxEdgeHandler.prototype.isCustomHandleEvent = function (me) {
				return !mxEvent.isShiftDown(me.getEvent());
			};

			/**
			 * Implements touch style
			 */
			if (Graph.touchStyle) {
				// Larger tolerance for real touch devices
				if (mxClient.IS_TOUCH || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0) {
					mxShape.prototype.svgStrokeTolerance = 18;
					mxVertexHandler.prototype.tolerance = 12;
					mxEdgeHandler.prototype.tolerance = 12;
					Graph.prototype.tolerance = 12;

					mxVertexHandler.prototype.rotationHandleVSpacing = -24;

					// Implements a smaller tolerance for mouse events and a larger tolerance for touch
					// events on touch devices. The default tolerance (4px) is used for mouse events.
					mxConstraintHandler.prototype.getTolerance = function (me) {
						return (mxEvent.isMouseEvent(me.getEvent())) ? 4 : this.graph.getTolerance();
					};
				}

				// One finger pans (no rubberband selection) must start regardless of mouse button
				mxPanningHandler.prototype.isPanningTrigger = function (me) {
					var evt = me.getEvent();

					return (me.getState() == null && !mxEvent.isMouseEvent(evt)) ||
						(mxEvent.isPopupTrigger(evt) && (me.getState() == null ||
							mxEvent.isControlDown(evt) || mxEvent.isShiftDown(evt)));
				};

				// Don't clear selection if multiple cells selected
				var graphHandlerMouseDown = mxGraphHandler.prototype.mouseDown;
				mxGraphHandler.prototype.mouseDown = function (sender, me) {
					graphHandlerMouseDown.apply(this, arguments);
					if (mxEvent.isTouchEvent(me.getEvent()) && this.graph.isCellSelected(me.getCell()) &&
						this.graph.getSelectionCount() > 1) {
						this.delayedSelection = false;
					}
				};
			}
			else {
				// Removes ctrl+shift as panning trigger for space splitting
				mxPanningHandler.prototype.isPanningTrigger = function (me) {
					var evt = me.getEvent();
					return (mxEvent.isLeftMouseButton(evt) && ((this.useLeftButtonForPanning &&
						me.getState() == null) || (mxEvent.isControlDown(evt) &&
							!mxEvent.isShiftDown(evt)))) || (this.usePopupTrigger &&
								mxEvent.isPopupTrigger(evt));
				};
			}

			// Overrides/extends rubberband for space handling with Ctrl+Shift(+Alt) drag ("scissors tool")
			mxRubberband.prototype.isSpaceEvent = function (me) {
				return this.graph.isEnabled() && !this.graph.isCellLocked(this.graph.getDefaultParent()) &&
					mxEvent.isControlDown(me.getEvent()) && mxEvent.isShiftDown(me.getEvent());
			};

			// Handles moving of cells in both half panes
			mxRubberband.prototype.mouseUp = function (sender, me) {
				var execute = this.div != null && this.div.style.display != 'none';

				var x0 = null;
				var y0 = null;
				var dx = null;
				var dy = null;

				if (this.first != null && this.currentX != null && this.currentY != null) {
					x0 = this.first.x;
					y0 = this.first.y;
					dx = (this.currentX - x0) / this.graph.view.scale;
					dy = (this.currentY - y0) / this.graph.view.scale;

					if (!mxEvent.isAltDown(me.getEvent())) {
						dx = this.graph.snap(dx);
						dy = this.graph.snap(dy);

						if (!this.graph.isGridEnabled()) {
							if (Math.abs(dx) < this.graph.tolerance) {
								dx = 0;
							}

							if (Math.abs(dy) < this.graph.tolerance) {
								dy = 0;
							}
						}
					}
				}

				this.reset();

				if (execute) {
					if (mxEvent.isAltDown(me.getEvent()) && this.graph.isToggleEvent(me.getEvent())) {
						var rect = new mxRectangle(this.x, this.y, this.width, this.height);
						var cells = this.graph.getCells(rect.x, rect.y, rect.width, rect.height);

						this.graph.removeSelectionCells(cells);
					}
					else if (this.isSpaceEvent(me)) {
						this.graph.model.beginUpdate();
						try {
							var cells = this.graph.getCellsBeyond(x0, y0, this.graph.getDefaultParent(), true, true);

							for (var i = 0; i < cells.length; i++) {
								if (this.graph.isCellMovable(cells[i])) {
									var tmp = this.graph.view.getState(cells[i]);
									var geo = this.graph.getCellGeometry(cells[i]);

									if (tmp != null && geo != null) {
										geo = geo.clone();
										geo.translate(dx, dy);
										this.graph.model.setGeometry(cells[i], geo);
									}
								}
							}
						}
						finally {
							this.graph.model.endUpdate();
						}
					}
					else {
						var rect = new mxRectangle(this.x, this.y, this.width, this.height);
						this.graph.selectRegion(rect, me.getEvent());
					}

					me.consume();
				}
			};

			// Handles preview for creating/removing space in diagram
			mxRubberband.prototype.mouseMove = function (sender, me) {
				if (!me.isConsumed() && this.first != null) {
					var origin = mxUtils.getScrollOrigin(this.graph.container);
					var offset = mxUtils.getOffset(this.graph.container);
					origin.x -= offset.x;
					origin.y -= offset.y;
					var x = me.getX() + origin.x;
					var y = me.getY() + origin.y;
					var dx = this.first.x - x;
					var dy = this.first.y - y;
					var tol = this.graph.tolerance;

					if (this.div != null || Math.abs(dx) > tol || Math.abs(dy) > tol) {
						if (this.div == null) {
							this.div = this.createShape();
						}

						// Clears selection while rubberbanding. This is required because
						// the event is not consumed in mouseDown.
						mxUtils.clearSelection();
						this.update(x, y);

						if (this.isSpaceEvent(me)) {
							var right = this.x + this.width;
							var bottom = this.y + this.height;
							var scale = this.graph.view.scale;

							if (!mxEvent.isAltDown(me.getEvent())) {
								this.width = this.graph.snap(this.width / scale) * scale;
								this.height = this.graph.snap(this.height / scale) * scale;

								if (!this.graph.isGridEnabled()) {
									if (this.width < this.graph.tolerance) {
										this.width = 0;
									}

									if (this.height < this.graph.tolerance) {
										this.height = 0;
									}
								}

								if (this.x < this.first.x) {
									this.x = right - this.width;
								}

								if (this.y < this.first.y) {
									this.y = bottom - this.height;
								}
							}

							this.div.style.borderStyle = 'dashed';
							this.div.style.backgroundColor = 'white';
							this.div.style.left = this.x + 'px';
							this.div.style.top = this.y + 'px';
							this.div.style.width = Math.max(0, this.width) + 'px';
							this.div.style.height = this.graph.container.clientHeight + 'px';
							this.div.style.borderWidth = (this.width <= 0) ? '0px 1px 0px 0px' : '0px 1px 0px 1px';

							if (this.secondDiv == null) {
								this.secondDiv = this.div.cloneNode(true);
								this.div.parentNode.appendChild(this.secondDiv);
							}

							this.secondDiv.style.left = this.x + 'px';
							this.secondDiv.style.top = this.y + 'px';
							this.secondDiv.style.width = this.graph.container.clientWidth + 'px';
							this.secondDiv.style.height = Math.max(0, this.height) + 'px';
							this.secondDiv.style.borderWidth = (this.height <= 0) ? '1px 0px 0px 0px' : '1px 0px 1px 0px';
						}
						else {
							// Hides second div and restores style
							this.div.style.backgroundColor = '';
							this.div.style.borderWidth = '';
							this.div.style.borderStyle = '';

							if (this.secondDiv != null) {
								this.secondDiv.parentNode.removeChild(this.secondDiv);
								this.secondDiv = null;
							}
						}

						me.consume();
					}
				}
			};

			// Removes preview
			var mxRubberbandReset = mxRubberband.prototype.reset;
			mxRubberband.prototype.reset = function () {
				if (this.secondDiv != null) {
					this.secondDiv.parentNode.removeChild(this.secondDiv);
					this.secondDiv = null;
				}

				mxRubberbandReset.apply(this, arguments);
			};

			// Timer-based activation of outline connect in connection handler
			var startTime = new Date().getTime();
			var timeOnTarget = 0;

			var mxEdgeHandlerUpdatePreviewState = mxEdgeHandler.prototype.updatePreviewState;

			mxEdgeHandler.prototype.updatePreviewState = function (edge, point, terminalState, me) {
				mxEdgeHandlerUpdatePreviewState.apply(this, arguments);

				if (terminalState != this.currentTerminalState) {
					startTime = new Date().getTime();
					timeOnTarget = 0;
				}
				else {
					timeOnTarget = new Date().getTime() - startTime;
				}

				this.currentTerminalState = terminalState;
			};

			// Timer-based outline connect
			var mxEdgeHandlerIsOutlineConnectEvent = mxEdgeHandler.prototype.isOutlineConnectEvent;

			mxEdgeHandler.prototype.isOutlineConnectEvent = function (me) {
				return (this.currentTerminalState != null && me.getState() == this.currentTerminalState && timeOnTarget > 2000) ||
					((this.currentTerminalState == null || mxUtils.getValue(this.currentTerminalState.style, 'outlineConnect', '1') != '0') &&
						mxEdgeHandlerIsOutlineConnectEvent.apply(this, arguments));
			};

			// Disables custom handles if shift is pressed
			mxVertexHandler.prototype.isCustomHandleEvent = function (me) {
				return !mxEvent.isShiftDown(me.getEvent());
			};

			// Shows secondary handle for fixed connection points
			mxEdgeHandler.prototype.createHandleShape = function (index, virtual) {
				var source = index != null && index == 0;
				var terminalState = this.state.getVisibleTerminalState(source);
				var c = (index != null && (index == 0 || index >= this.state.absolutePoints.length - 1 ||
					(this.constructor == mxElbowEdgeHandler && index == 2))) ?
					this.graph.getConnectionConstraint(this.state, terminalState, source) : null;
				var pt = (c != null) ? this.graph.getConnectionPoint(this.state.getVisibleTerminalState(source), c) : null;
				var img = (pt != null) ? this.fixedHandleImage : ((c != null && terminalState != null) ?
					this.terminalHandleImage : this.handleImage);

				if (img != null) {
					var shape = new mxImageShape(new mxRectangle(0, 0, img.width, img.height), img.src);

					// Allows HTML rendering of the images
					shape.preserveImageAspect = false;

					return shape;
				}
				else {
					var s = mxConstants.HANDLE_SIZE;

					if (this.preferHtml) {
						s -= 1;
					}

					return new mxRectangleShape(new mxRectangle(0, 0, s, s), mxConstants.HANDLE_FILLCOLOR, mxConstants.HANDLE_STROKECOLOR);
				}
			};

			var vertexHandlerCreateSizerShape = mxVertexHandler.prototype.createSizerShape;
			mxVertexHandler.prototype.createSizerShape = function (bounds, index, fillColor) {
				this.handleImage = (index == mxEvent.ROTATION_HANDLE) ? HoverIcons.prototype.rotationHandle : (index == mxEvent.LABEL_HANDLE) ? this.secondaryHandleImage : this.handleImage;

				return vertexHandlerCreateSizerShape.apply(this, arguments);
			};

			// Special case for single edge label handle moving in which case the text bounding box is used
			var mxGraphHandlerGetBoundingBox = mxGraphHandler.prototype.getBoundingBox;
			mxGraphHandler.prototype.getBoundingBox = function (cells) {
				if (cells != null && cells.length == 1) {
					var model = this.graph.getModel();
					var parent = model.getParent(cells[0]);
					var geo = this.graph.getCellGeometry(cells[0]);

					if (model.isEdge(parent) && geo != null && geo.relative) {
						var state = this.graph.view.getState(cells[0]);

						if (state != null && state.width < 2 && state.height < 2 && state.text != null && state.text.boundingBox != null) {
							return mxRectangle.fromRectangle(state.text.boundingBox);
						}
					}
				}

				return mxGraphHandlerGetBoundingBox.apply(this, arguments);
			};

			// Uses text bounding box for edge labels
			var mxVertexHandlerGetSelectionBounds = mxVertexHandler.prototype.getSelectionBounds;
			mxVertexHandler.prototype.getSelectionBounds = function (state) {
				var model = this.graph.getModel();
				var parent = model.getParent(state.cell);
				var geo = this.graph.getCellGeometry(state.cell);

				if (model.isEdge(parent) && geo != null && geo.relative && state.width < 2 && state.height < 2 && state.text != null && state.text.boundingBox != null) {
					var bbox = state.text.unrotatedBoundingBox || state.text.boundingBox;

					return new mxRectangle(Math.round(bbox.x), Math.round(bbox.y), Math.round(bbox.width), Math.round(bbox.height));
				}
				else {
					return mxVertexHandlerGetSelectionBounds.apply(this, arguments);
				}
			};

			// Redirects moving of edge labels to mxGraphHandler by not starting here.
			// This will use the move preview of mxGraphHandler (see above).
			var mxVertexHandlerMouseDown = mxVertexHandler.prototype.mouseDown;
			mxVertexHandler.prototype.mouseDown = function (sender, me) {
				var model = this.graph.getModel();
				var parent = model.getParent(this.state.cell);
				var geo = this.graph.getCellGeometry(this.state.cell);

				// Lets rotation events through
				var handle = this.getHandleForEvent(me);

				if (handle == mxEvent.ROTATION_HANDLE || !model.isEdge(parent) || geo == null || !geo.relative ||
					this.state == null || this.state.width >= 2 || this.state.height >= 2) {
					mxVertexHandlerMouseDown.apply(this, arguments);
				}
			};

			// Shows rotation handle for edge labels.
			mxVertexHandler.prototype.isRotationHandleVisible = function () {
				return this.graph.isEnabled() && this.rotationEnabled && this.graph.isCellRotatable(this.state.cell) &&
					(mxGraphHandler.prototype.maxCells <= 0 || this.graph.getSelectionCount() < mxGraphHandler.prototype.maxCells);
			};

			// Invokes turn on single click on rotation handle
			mxVertexHandler.prototype.rotateClick = function () {
				this.state.view.graph.turnShapes([this.state.cell]);
			};

			var vertexHandlerMouseMove = mxVertexHandler.prototype.mouseMove;

			// Workaround for "isConsumed not defined" in MS Edge is to use arguments
			mxVertexHandler.prototype.mouseMove = function (sender, me) {
				vertexHandlerMouseMove.apply(this, arguments);

				if (this.graph.graphHandler.first != null) {
					if (this.rotationShape != null && this.rotationShape.node != null) {
						this.rotationShape.node.style.display = 'none';
					}
				}
			};

			var vertexHandlerMouseUp = mxVertexHandler.prototype.mouseUp;
			mxVertexHandler.prototype.mouseUp = function (sender, me) {
				vertexHandlerMouseUp.apply(this, arguments);

				// Shows rotation handle only if one vertex is selected
				if (this.rotationShape != null && this.rotationShape.node != null) {
					this.rotationShape.node.style.display = (this.graph.getSelectionCount() == 1) ? '' : 'none';
				}
			};

			var vertexHandlerInit = mxVertexHandler.prototype.init;
			mxVertexHandler.prototype.init = function () {
				vertexHandlerInit.apply(this, arguments);
				var redraw = false;

				if (this.rotationShape != null) {
					this.rotationShape.node.setAttribute('title', mxResources.get('rotateTooltip'));
				}

				var update = mxUtils.bind(this, function () {
					// Shows rotation handle only if one vertex is selected
					if (this.rotationShape != null && this.rotationShape.node != null) {
						this.rotationShape.node.style.display = (this.graph.getSelectionCount() == 1) ? '' : 'none';
					}

					if (this.specialHandle != null) {
						this.specialHandle.node.style.display = (this.graph.isEnabled() && this.graph.getSelectionCount() < this.graph.graphHandler.maxCells) ? '' : 'none';
					}

					this.redrawHandles();
				});

				this.selectionHandler = mxUtils.bind(this, function (sender, evt) {
					update();
				});

				this.graph.getSelectionModel().addListener(mxEvent.CHANGE, this.selectionHandler);

				this.changeHandler = mxUtils.bind(this, function (sender, evt) {
					this.updateLinkHint(this.graph.getLinkForCell(this.state.cell),
						this.graph.getLinksForState(this.state));
					update();
				});

				this.graph.getModel().addListener(mxEvent.CHANGE, this.changeHandler);

				// Repaint needed when editing stops and no change event is fired
				this.editingHandler = mxUtils.bind(this, function (sender, evt) {
					this.redrawHandles();
				});

				this.graph.addListener(mxEvent.EDITING_STOPPED, this.editingHandler);

				var link = this.graph.getLinkForCell(this.state.cell);
				var links = this.graph.getLinksForState(this.state);
				this.updateLinkHint(link, links);

				if (link != null || (links != null && links.length > 0)) {
					redraw = true;
				}

				if (redraw) {
					this.redrawHandles();
				}
			};

			mxVertexHandler.prototype.updateLinkHint = function (link, links) {
				if ((link == null && (links == null || links.length == 0)) ||
					this.graph.getSelectionCount() > 1) {
					if (this.linkHint != null) {
						this.linkHint.parentNode.removeChild(this.linkHint);
						this.linkHint = null;
					}
				}
				else if (link != null || (links != null && links.length > 0)) {
					if (this.linkHint == null) {
						this.linkHint = createHint();
						this.linkHint.style.padding = '6px 8px 6px 8px';
						this.linkHint.style.opacity = '1';
						this.linkHint.style.filter = '';

						this.graph.container.appendChild(this.linkHint);
					}

					this.linkHint.innerHTML = '';

					if (link != null) {
						this.linkHint.appendChild(this.graph.createLinkForHint(link));

						if (this.graph.isEnabled() && typeof this.graph.editLink === 'function') {
							var changeLink = document.createElement('img');
							changeLink.setAttribute('src', Editor.editImage);
							changeLink.setAttribute('title', mxResources.get('editLink'));
							changeLink.setAttribute('width', '11');
							changeLink.setAttribute('height', '11');
							changeLink.style.marginLeft = '10px';
							changeLink.style.marginBottom = '-1px';
							changeLink.style.cursor = 'pointer';
							this.linkHint.appendChild(changeLink);

							mxEvent.addListener(changeLink, 'click', mxUtils.bind(this, function (evt) {
								this.graph.setSelectionCell(this.state.cell);
								this.graph.editLink();
								mxEvent.consume(evt);
							}));

							var removeLink = document.createElement('img');
							removeLink.setAttribute('src', Dialog.prototype.clearImage);
							removeLink.setAttribute('title', mxResources.get('removeIt', [mxResources.get('link')]));
							removeLink.setAttribute('width', '13');
							removeLink.setAttribute('height', '10');
							removeLink.style.marginLeft = '4px';
							removeLink.style.marginBottom = '-1px';
							removeLink.style.cursor = 'pointer';
							this.linkHint.appendChild(removeLink);

							mxEvent.addListener(removeLink, 'click', mxUtils.bind(this, function (evt) {
								this.graph.setLinkForCell(this.state.cell, null);
								mxEvent.consume(evt);
							}));
						}
					}

					if (links != null) {
						for (var i = 0; i < links.length; i++) {
							var div = document.createElement('div');
							div.style.marginTop = (link != null || i > 0) ? '6px' : '0px';
							div.appendChild(this.graph.createLinkForHint(
								links[i].getAttribute('href'),
								mxUtils.getTextContent(links[i])));

							this.linkHint.appendChild(div);
						}
					}
				}
			};

			mxEdgeHandler.prototype.updateLinkHint = mxVertexHandler.prototype.updateLinkHint;

			var edgeHandlerInit = mxEdgeHandler.prototype.init;
			mxEdgeHandler.prototype.init = function () {
				edgeHandlerInit.apply(this, arguments);

				// Disables connection points
				this.constraintHandler.isEnabled = mxUtils.bind(this, function () {
					return this.state.view.graph.connectionHandler.isEnabled();
				});

				var update = mxUtils.bind(this, function () {
					if (this.linkHint != null) {
						this.linkHint.style.display = (this.graph.getSelectionCount() == 1) ? '' : 'none';
					}

					if (this.labelShape != null) {
						this.labelShape.node.style.display = (this.graph.isEnabled() && this.graph.getSelectionCount() < this.graph.graphHandler.maxCells) ? '' : 'none';
					}
				});

				this.selectionHandler = mxUtils.bind(this, function (sender, evt) {
					update();
				});

				this.graph.getSelectionModel().addListener(mxEvent.CHANGE, this.selectionHandler);

				this.changeHandler = mxUtils.bind(this, function (sender, evt) {
					this.updateLinkHint(this.graph.getLinkForCell(this.state.cell),
						this.graph.getLinksForState(this.state));
					update();
					this.redrawHandles();
				});

				this.graph.getModel().addListener(mxEvent.CHANGE, this.changeHandler);

				var link = this.graph.getLinkForCell(this.state.cell);
				var links = this.graph.getLinksForState(this.state);

				if (link != null || (links != null && links.length > 0)) {
					this.updateLinkHint(link, links);
					this.redrawHandles();
				}
			};

			// Disables connection points
			var connectionHandlerInit = mxConnectionHandler.prototype.init;

			mxConnectionHandler.prototype.init = function () {
				connectionHandlerInit.apply(this, arguments);

				this.constraintHandler.isEnabled = mxUtils.bind(this, function () {
					return this.graph.connectionHandler.isEnabled();
				});
			};

			var vertexHandlerRedrawHandles = mxVertexHandler.prototype.redrawHandles;
			mxVertexHandler.prototype.redrawHandles = function () {
				vertexHandlerRedrawHandles.apply(this);

				if (this.state != null && this.linkHint != null) {
					var c = new mxPoint(this.state.getCenterX(), this.state.getCenterY());
					var tmp = new mxRectangle(this.state.x, this.state.y - 22, this.state.width + 24, this.state.height + 22);
					var bb = mxUtils.getBoundingBox(tmp, this.state.style[mxConstants.STYLE_ROTATION] || '0', c);
					var rs = (bb != null) ? mxUtils.getBoundingBox(this.state,
						this.state.style[mxConstants.STYLE_ROTATION] || '0') : this.state;
					var tb = (this.state.text != null) ? this.state.text.boundingBox : null;

					if (bb == null) {
						bb = this.state;
					}

					var b = bb.y + bb.height;

					if (tb != null) {
						b = Math.max(b, tb.y + tb.height);
					}

					this.linkHint.style.left = Math.max(0, Math.round(rs.x + (rs.width - this.linkHint.clientWidth) / 2)) + 'px';
					this.linkHint.style.top = Math.round(b + this.verticalOffset / 2 + 6 +
						this.state.view.graph.tolerance) + 'px';
				}
			};


			var vertexHandlerReset = mxVertexHandler.prototype.reset;
			mxVertexHandler.prototype.reset = function () {
				vertexHandlerReset.apply(this, arguments);

				// Shows rotation handle only if one vertex is selected
				if (this.rotationShape != null && this.rotationShape.node != null) {
					this.rotationShape.node.style.display = (this.graph.getSelectionCount() == 1) ? '' : 'none';
				}
			};

			var vertexHandlerDestroy = mxVertexHandler.prototype.destroy;
			mxVertexHandler.prototype.destroy = function () {
				vertexHandlerDestroy.apply(this, arguments);

				if (this.linkHint != null) {
					this.linkHint.parentNode.removeChild(this.linkHint);
					this.linkHint = null;
				}

				if (this.selectionHandler != null) {
					this.graph.getSelectionModel().removeListener(this.selectionHandler);
					this.selectionHandler = null;
				}

				if (this.changeHandler != null) {
					this.graph.getModel().removeListener(this.changeHandler);
					this.changeHandler = null;
				}

				if (this.editingHandler != null) {
					this.graph.removeListener(this.editingHandler);
					this.editingHandler = null;
				}
			};

			var edgeHandlerRedrawHandles = mxEdgeHandler.prototype.redrawHandles;
			mxEdgeHandler.prototype.redrawHandles = function () {
				// Workaround for special case where handler
				// is reset before this which leads to a NPE
				if (this.marker != null) {
					edgeHandlerRedrawHandles.apply(this);

					if (this.state != null && this.linkHint != null) {
						var b = this.state;

						if (this.state.text != null && this.state.text.bounds != null) {
							b = new mxRectangle(b.x, b.y, b.width, b.height);
							b.add(this.state.text.bounds);
						}

						this.linkHint.style.left = Math.max(0, Math.round(b.x + (b.width - this.linkHint.clientWidth) / 2)) + 'px';
						this.linkHint.style.top = Math.round(b.y + b.height + 6 + this.state.view.graph.tolerance) + 'px';
					}
				}
			};

			var edgeHandlerReset = mxEdgeHandler.prototype.reset;
			mxEdgeHandler.prototype.reset = function () {
				edgeHandlerReset.apply(this, arguments);

				if (this.linkHint != null) {
					this.linkHint.style.visibility = '';
				}
			};

			var edgeHandlerDestroy = mxEdgeHandler.prototype.destroy;
			mxEdgeHandler.prototype.destroy = function () {
				edgeHandlerDestroy.apply(this, arguments);

				if (this.linkHint != null) {
					this.linkHint.parentNode.removeChild(this.linkHint);
					this.linkHint = null;
				}

				if (this.selectionHandler != null) {
					this.graph.getSelectionModel().removeListener(this.selectionHandler);
					this.selectionHandler = null;
				}

				if (this.changeHandler != null) {
					this.graph.getModel().removeListener(this.changeHandler);
					this.changeHandler = null;
				}
			};
		})();
	}
	return Graph;
}