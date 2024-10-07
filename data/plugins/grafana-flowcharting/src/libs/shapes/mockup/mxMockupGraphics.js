/**
 * $Id: mxMockupGraphics.js,v 1.5 2013/05/22 12:28:49 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Bar Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupBarChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupBarChart, mxShape);

mxShapeMockupBarChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		FILL_COLOR2 : 'fillColor2',
		FILL_COLOR3 : 'fillColor3',
		SHAPE_BAR_CHART : 'mxgraph.mockup.graphics.barChart'
};

mxShapeMockupBarChart.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Stroke2 Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Stroke3 Color', type: 'color'},
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'},
	{name: 'fillColor3', dispName: 'Fill3 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupBarChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, x, y, w, h);

	var bgFill = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, 'none');

	if (bgFill !== 'none')
	{
		c.setShadow(false);
	}

	this.bars(c, x, y, w, h);
};

mxShapeMockupBarChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupBarChart.prototype.bars = function(c, x, y, w, h)
{
	var barStroke = mxUtils.getValue(this.style, mxShapeMockupBarChart.prototype.cst.STROKE_COLOR2, 'none');
	var coordStroke = mxUtils.getValue(this.style, mxShapeMockupBarChart.prototype.cst.STROKE_COLOR3, '#666666');
	var barFill1 = mxUtils.getValue(this.style, mxShapeMockupBarChart.prototype.cst.FILL_COLOR2, '#008cff');
	var barFill2 = mxUtils.getValue(this.style, mxShapeMockupBarChart.prototype.cst.FILL_COLOR3, '#dddddd');

	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');

	c.setStrokeColor(barStroke);
	c.setFillColor(barFill1);
	c.rect(0, h * 0.2, w * 0.75, h * 0.05);
	c.fillAndStroke();
	c.rect(0, h * 0.45, w * 0.6, h * 0.05);
	c.fillAndStroke();
	c.rect(0, h * 0.7, w * 0.95, h * 0.05);
	c.fillAndStroke();

	c.setFillColor(barFill2);
	c.rect(0, h * 0.25, w * 0.85, h * 0.05);
	c.fillAndStroke();
	c.rect(0, h * 0.5, w * 0.65, h * 0.05);
	c.fillAndStroke();
	c.rect(0, h * 0.75, w * 0.8, h * 0.05);
	c.fillAndStroke();

	c.setStrokeWidth(strokeWidth * 2);
	c.setStrokeColor(coordStroke);

	c.setShadow(false);
	c.begin();
	c.moveTo(0,0);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupBarChart.prototype.cst.SHAPE_BAR_CHART, mxShapeMockupBarChart);

//**********************************************************************************************************************************************************
//Column Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupColumnChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupColumnChart, mxShape);

mxShapeMockupColumnChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		FILL_COLOR2 : 'fillColor2',
		FILL_COLOR3 : 'fillColor3',
		SHAPE_COLUMN_CHART : 'mxgraph.mockup.graphics.columnChart'
};

mxShapeMockupColumnChart.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Bar Stroke Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Coord System Color', type: 'color'},
	{name: 'fillColor2', dispName: 'Bar1 Color', type: 'color'},
	{name: 'fillColor3', dispName: 'Bar2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupColumnChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, x, y, w, h);

	var bgFill = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, 'none');

	if (bgFill !== 'none')
	{
		c.setShadow(false);
	}

	this.bars(c, x, y, w, h);
};

mxShapeMockupColumnChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupColumnChart.prototype.bars = function(c, x, y, w, h)
{
	var barStroke = mxUtils.getValue(this.style, mxShapeMockupColumnChart.prototype.cst.STROKE_COLOR2, 'none');
	var coordStroke = mxUtils.getValue(this.style, mxShapeMockupColumnChart.prototype.cst.STROKE_COLOR3, '#666666');
	var barFill1 = mxUtils.getValue(this.style, mxShapeMockupColumnChart.prototype.cst.FILL_COLOR2, '#008cff');
	var barFill2 = mxUtils.getValue(this.style, mxShapeMockupColumnChart.prototype.cst.FILL_COLOR3, '#dddddd');

	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');

	c.setStrokeColor(barStroke);
	c.setFillColor(barFill1);
	c.rect(w * 0.2, h * 0.25, w * 0.05, h * 0.75);
	c.fillAndStroke();
	c.rect(w * 0.45, h * 0.4, w * 0.05, h * 0.6);
	c.fillAndStroke();
	c.rect(w * 0.7, h * 0.05, w * 0.05, h * 0.95);
	c.fillAndStroke();

	c.setFillColor(barFill2);
	c.rect(w * 0.25, h * 0.15, w * 0.05, h * 0.85);
	c.fillAndStroke();
	c.rect(w * 0.5, h * 0.35, w * 0.05, h * 0.65);
	c.fillAndStroke();
	c.rect(w * 0.75, h * 0.2, w * 0.05, h * 0.8);
	c.fillAndStroke();

	c.setStrokeWidth(strokeWidth * 2);
	c.setStrokeColor(coordStroke);

	c.setShadow(false);

	c.begin();
	c.moveTo(0,0);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupColumnChart.prototype.cst.SHAPE_COLUMN_CHART, mxShapeMockupColumnChart);

//**********************************************************************************************************************************************************
//Line Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupLineChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupLineChart, mxShape);

mxShapeMockupLineChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		STROKE_COLOR4 : 'strokeColor4',
		SHAPE_LINE_CHART : 'mxgraph.mockup.graphics.lineChart'
};

mxShapeMockupLineChart.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Coord. System Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Line1 Color', type: 'color'},
	{name: 'strokeColor4', dispName: 'Line2 Color', type: 'color'},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupLineChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, x, y, w, h);

	var bgFill = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, 'none');

	if (bgFill !== 'none')
	{
		c.setShadow(false);
	}

	this.bars(c, x, y, w, h);
};

mxShapeMockupLineChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupLineChart.prototype.bars = function(c, x, y, w, h)
{
	var coordStroke = mxUtils.getValue(this.style, mxShapeMockupLineChart.prototype.cst.STROKE_COLOR2, '#666666');
	var line1Stroke = mxUtils.getValue(this.style, mxShapeMockupLineChart.prototype.cst.STROKE_COLOR3, '#008cff');
	var line2Stroke = mxUtils.getValue(this.style, mxShapeMockupLineChart.prototype.cst.STROKE_COLOR4, '#dddddd');

	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');

	c.setStrokeWidth(strokeWidth * 2);
	c.setStrokeColor(line2Stroke);
	c.begin();
	c.moveTo(0, h);
	c.lineTo(w * 0.3, h * 0.5);
	c.lineTo(w * 0.6, h * 0.74);
	c.lineTo(w * 0.9, h * 0.24);
	c.stroke();

	c.setStrokeColor(line1Stroke);
	c.begin();
	c.moveTo(0, h);
	c.lineTo(w * 0.3, h * 0.65);
	c.lineTo(w * 0.6, h * 0.6);
	c.lineTo(w * 0.9, h * 0.35);
	c.stroke();

	c.setStrokeColor(coordStroke);
	c.setShadow(false);

	c.begin();
	c.moveTo(0,0);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupLineChart.prototype.cst.SHAPE_LINE_CHART, mxShapeMockupLineChart);

//**********************************************************************************************************************************************************
//Pie Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupPieChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupPieChart, mxShape);

mxShapeMockupPieChart.prototype.cst = {
		PARTS : 'parts',
		PART_COLORS : 'partColors',
		SHAPE_PIE_CHART : 'mxgraph.mockup.graphics.pieChart'
};

mxShapeMockupPieChart.prototype.customProperties = [
	{name: 'partsCount', dispName: 'partsCount', type: 'int', defVal: 4, dependentProps: ['partColors', 'parts']},
	{name: 'partColors', dispName: 'Part Colors', type: 'staticArr', subType: 'color', sizeProperty: 'partsCount', subDefVal: '#FFFFFF'},
	{name: 'parts', dispName: 'Part Sizes', type: 'staticArr', subType: 'int', sizeProperty: 'partsCount', subDefVal: '10'},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupPieChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupPieChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupPieChart.prototype.foreground = function(c, x, y, w, h)
{
	var parts = mxUtils.getValue(this.style, mxShapeMockupPieChart.prototype.cst.PARTS, '10,20,30').toString().split(',');
	var partNum = parts.length;
	var partColors = mxUtils.getValue(this.style, mxShapeMockupPieChart.prototype.cst.PART_COLORS, '#333333,#666666,#999999').toString().split(',');
	var total = 0;

	for (var i = 0; i < partNum; i++)
	{
		total = total + parseInt(parts[i], 10);
	}


	for (var i = 0; i < partNum; i++)
	{
		if (partColors.length > i)
		{
			c.setFillColor(partColors[i]);
		}
		else
		{
			c.setFillColor('#ff0000');
		}

		var beginPerc = 0;
		var endPerc = 0;
		var currPerc = parseInt(parts[i], 10) / total;

		if (currPerc === 0.5)
		{
			currPerc = 0.501;
		}

		for (var j = 0; j < i; j++)
		{
			beginPerc = beginPerc + parseInt(parts[j], 10) / total;
		}

		endPerc = currPerc + beginPerc;
		var startAngle = 2 * Math.PI * beginPerc;
		var endAngle = 2 * Math.PI * endPerc;

		var x1 = w * 0.5 - w * Math.sin(startAngle) * 0.5;
		var y1 = h * 0.5 - h * Math.cos(startAngle) * 0.5;
		var x2 = w * 0.5 - w * Math.sin(endAngle) * 0.5;
		var y2 = h * 0.5 - h * Math.cos(endAngle) * 0.5;		
		var largeArc = 1;
		var sweep = 1;

		if (endPerc - beginPerc < 0.5)
		{
			largeArc = 0;
		}

		c.begin();
		c.moveTo(w * 0.5, h * 0.5);
		c.lineTo(x2, y2);
		c.arcTo(w * 0.5, h * 0.5, 0, largeArc, 1, x1, y1);
		c.close();
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeMockupPieChart.prototype.cst.SHAPE_PIE_CHART, mxShapeMockupPieChart);

//**********************************************************************************************************************************************************
//Icon Grid (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupIconGrid(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupIconGrid, mxShape);

mxShapeMockupIconGrid.prototype.cst = {
		GRID_SIZE : 'gridSize',
		SHAPE_ICON_GRID : 'mxgraph.mockup.graphics.iconGrid'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupIconGrid.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var gridSize = mxUtils.getValue(this.style, mxShapeMockupIconGrid.prototype.cst.GRID_SIZE, '3,3').toString().split(',');
	this.background(c, w, h, gridSize);
	c.setShadow(false);

	this.foreground(c, w, h, gridSize);
};

mxShapeMockupIconGrid.prototype.background = function(c, w, h, gridSize)
{
	var boxSizeX = w / (parseInt(gridSize[0],10) + (gridSize[0]-1) * 0.5);
	var boxSizeY = h / (parseInt(gridSize[1],10) + (gridSize[1]-1) * 0.5);

	for (var i = 0; i < gridSize[0]; i++)
	{
		for (var j = 0; j < gridSize[1]; j++)
		{
			c.rect(boxSizeX * 1.5 * i, boxSizeY * 1.5 * j, boxSizeX, boxSizeY);
			c.fillAndStroke();
		}
	}
};

mxShapeMockupIconGrid.prototype.foreground = function(c, w, h, gridSize)
{
	var boxSizeX = w / (parseInt(gridSize[0],10) + (gridSize[0]-1) * 0.5);
	var boxSizeY = h / (parseInt(gridSize[1],10) + (gridSize[1]-1) * 0.5);

	for (var i = 0; i < gridSize[0]; i++)
	{
		for (var j = 0; j < gridSize[1]; j++)
		{
			c.begin();
			c.moveTo(boxSizeX * 1.5 * i, boxSizeY * 1.5 * j);
			c.lineTo(boxSizeX * 1.5 * i + boxSizeX, boxSizeY * 1.5 * j + boxSizeY);
			c.moveTo(boxSizeX * 1.5 * i + boxSizeX, boxSizeY * 1.5 * j);
			c.lineTo(boxSizeX * 1.5 * i, boxSizeY * 1.5 * j + boxSizeY);
			c.stroke();
		}
	}
};

mxCellRenderer.registerShape(mxShapeMockupIconGrid.prototype.cst.SHAPE_ICON_GRID, mxShapeMockupIconGrid);

//**********************************************************************************************************************************************************
//Bubble Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupBubbleChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupBubbleChart, mxShape);

mxShapeMockupBubbleChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		FILL_COLOR2 : 'fillColor2',
		FILL_COLOR3 : 'fillColor3',
		SHAPE_BUBBLE_CHART : 'mxgraph.mockup.graphics.bubbleChart'
};

mxShapeMockupBubbleChart.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Bubble Stroke Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Coord. System Color', type: 'color'},
	{name: 'fillColor2', dispName: 'Bubble1 Color', type: 'color'},
	{name: 'fillColor3', dispName: 'Bubble2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupBubbleChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, x, y, w, h);

	var bgFill = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, 'none');

	if (bgFill !== 'none')
	{
		c.setShadow(false);
	}

	this.bars(c, x, y, w, h);
};

mxShapeMockupBubbleChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupBubbleChart.prototype.bars = function(c, x, y, w, h)
{
	var barStroke = mxUtils.getValue(this.style, mxShapeMockupBubbleChart.prototype.cst.STROKE_COLOR2, 'none');
	var coordStroke = mxUtils.getValue(this.style, mxShapeMockupBubbleChart.prototype.cst.STROKE_COLOR3, '#666666');
	var barFill1 = mxUtils.getValue(this.style, mxShapeMockupBubbleChart.prototype.cst.FILL_COLOR2, '#008cff');
	var barFill2 = mxUtils.getValue(this.style, mxShapeMockupBubbleChart.prototype.cst.FILL_COLOR3, '#dddddd');

	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');

	c.setStrokeColor(barStroke);
	c.setFillColor(barFill1);

	var cx = w * 0.4;
	var cy = h * 0.45; 
	var r = Math.min(h, w) * 0.14;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	cx = w * 0.1;
	cy = h * 0.8; 
	r = Math.min(h, w) * 0.1;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	cx = w * 0.7;
	cy = h * 0.7; 
	r = Math.min(h, w) * 0.22;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	c.setFillColor(barFill2);
	cx = w * 0.15;
	cy = h * 0.25; 
	r = Math.min(h, w) * 0.19;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	cx = w * 0.48;
	cy = h * 0.7; 
	r = Math.min(h, w) * 0.12;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	cx = w * 0.74;
	cy = h * 0.17; 
	r = Math.min(h, w) * 0.1;
	c.ellipse(cx - r, cy - r, 2 * r, 2 * r);
	c.fillAndStroke();

	c.setStrokeWidth(strokeWidth * 2);
	c.setStrokeColor(coordStroke);

	c.setShadow(false);
	c.begin();
	c.moveTo(0,0);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupBubbleChart.prototype.cst.SHAPE_BUBBLE_CHART, mxShapeMockupBubbleChart);

//**********************************************************************************************************************************************************
//Gauge
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupGauge(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.gaugePos = 25;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupGauge, mxShape);

mxShapeMockupGauge.prototype.cst = {
		SCALE_COLORS : 'scaleColors',
		GAUGE_LABELS : 'gaugeLabels',
		NEEDLE_COLOR : 'needleColor',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		GAUGE_POS : 'gaugePos',
		SHAPE_GAUGE : 'mxgraph.mockup.graphics.gauge'
};

mxShapeMockupGauge.prototype.customProperties = [
	{name: 'scaleColors', dispName: 'Scale Colors', type: 'String'},
	{name: 'needleColor', dispName: 'Needle Color', type: 'color'},
	{name: 'gaugePos', dispName: 'Needle Position', type: 'float', min:0, max:100, defVal:25}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupGauge.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupGauge.prototype.background = function(c, w, h)
{
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupGauge.prototype.foreground = function(c, w, h)
{
	var gaugePos = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.GAUGE_POS, '0');
	var scaleColors = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.SCALE_COLORS, '#888888,#aaaaaa,#444444').toString().split(',');
	var gaugeLabels = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.GAUGE_LABELS, 'CPU[%],0,100').toString().split(',');
	var needleColor = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.NEEDLE_COLOR, '#008cff');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.TEXT_COLOR, '#666666');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupGauge.prototype.cst.TEXT_SIZE, '12');

	gaugePos = Math.max(0, gaugePos);
	gaugePos = Math.min(100, gaugePos);

	c.setFillColor(scaleColors[1]);
	c.begin();
	c.moveTo(w * 0.05, h * 0.5);
	c.arcTo(w * 0.4, h * 0.4, 0, 0, 1, w * 0.95, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.arcTo(w * 0.5, h * 0.5, 0, 0, 0, 0, h * 0.5);
	c.close();
	c.fill();

	c.setFillColor(scaleColors[0]);
	c.begin();
	c.moveTo(w * 0.05, h * 0.5);
	c.arcTo(w * 0.45, h * 0.45, 0, 0, 0, w * 0.182, h * 0.818);
	c.lineTo(w * 0.146, h * 0.854);
	c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, 0, h * 0.5);
	c.close();
	c.fill();

	c.setFillColor(scaleColors[2]);
	c.begin();
	c.moveTo(w, h * 0.5);
	c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, w * 0.854, h * 0.854);
	c.lineTo(w * 0.818, h * 0.818);
	c.arcTo(w * 0.45, h * 0.45, 0, 0, 0, w * 0.95, h * 0.5);
	c.close();
	c.fill();

	c.setFontSize(textSize);
	c.setFontColor(textColor);
	c.text(w * 0.5, h * 0.3, 0, 0, gaugeLabels[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.2, h * 0.85, 0, 0, gaugeLabels[1], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8, h * 0.85, 0, 0, gaugeLabels[2], mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var needlePos = (0.75 * (2 * Math.PI * parseFloat(gaugePos) / 100) + 1.25 * Math.PI);

	var x1 = w * 0.5 + w * 0.38 * Math.sin(needlePos);
	var y1 = h * 0.5 - h * 0.38 * Math.cos(needlePos);
	var x2 = 0;
	var y2 = 0;
	c.setFillColor(needleColor);
	c.begin();
	c.moveTo(x1, y1);

	x1 = w * 0.5 + w * 0.05 * Math.cos(needlePos);
	y1 = h * 0.5 + h * 0.05 * Math.sin(needlePos);
	c.lineTo(x1, y1);

	x2 = w * 0.5 + w * (-0.05) * Math.sin(needlePos);
	y2 = h * 0.5 - h * (-0.05) * Math.cos(needlePos);
	c.arcTo(w * 0.05, h * 0.05, 0, 0, 1, x2, y2);

	x1 = x2;
	y1 = y2;
	x2 = w * 0.5 - w * 0.05 * Math.cos(needlePos);
	y2 = h * 0.5 - h * 0.05 * Math.sin(needlePos);
	c.arcTo(w * 0.05, h * 0.05, 0, 0, 1, x2, y2);
	c.close();
	c.fill();

	c.setFillColor(fillColor);
	c.begin();
	c.moveTo(w * 0.49, h * 0.49);
	c.lineTo(w * 0.51, h * 0.49);
	c.lineTo(w * 0.51, h * 0.51);
	c.lineTo(w * 0.49, h * 0.51);
	c.close();
	c.fill();

	c.begin();
	c.ellipse(0, 0, w, h);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.146, h * 0.854);
	c.lineTo(w * 0.219, h * 0.781);
	c.moveTo(w * 0.854, h * 0.854);
	c.lineTo(w * 0.781, h * 0.781);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupGauge.prototype.cst.SHAPE_GAUGE, mxShapeMockupGauge);

Graph.handleFactory[mxShapeMockupGauge.prototype.cst.SHAPE_GAUGE] = function(state)
{
	var handles = [Graph.createHandle(state, ['gaugePos'], function(bounds)
			{
				var gaugePos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'gaugePos', this.gaugePos))));

				return new mxPoint(bounds.x + bounds.width * 0.2 + gaugePos * 0.6 * bounds.width / 100, bounds.y + bounds.height * 0.8);
			}, function(bounds, pt)
			{
				this.state.style['gaugePos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}

//**********************************************************************************************************************************************************
//Plot Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupPlotChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupPlotChart, mxShape);

mxShapeMockupPlotChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		SHAPES_COLORS : 'fillColor2',
		SHAPE_PLOT_CHART : 'mxgraph.mockup.graphics.plotChart'
};

mxShapeMockupPlotChart.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Bubble Stroke Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Coord. System Color', type: 'color'},
	{name: 'fillColor2', dispName: 'Shapes Color', type: 'string'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupPlotChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, x, y, w, h);

	var bgFill = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, 'none');

	if (bgFill !== 'none')
	{
		c.setShadow(false);
	}

	this.foreground(c, x, y, w, h);
};

mxShapeMockupPlotChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupPlotChart.prototype.foreground = function(c, x, y, w, h)
{
	var shapeStroke = mxUtils.getValue(this.style, mxShapeMockupPlotChart.prototype.cst.STROKE_COLOR2, '#dddddd');
	var coordStroke = mxUtils.getValue(this.style, mxShapeMockupPlotChart.prototype.cst.STROKE_COLOR3, '#666666');
	var shapesColors = mxUtils.getValue(this.style, mxShapeMockupPlotChart.prototype.cst.SHAPES_COLORS, '#00aaff,#0044ff,#008cff').toString().split(',');

	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');
	var shapeSize = Math.min(w, h) * 0.03;

	c.setStrokeColor(shapeStroke);
	c.setFillColor(shapesColors[0]);

	var cx = w * 0.2;
	var cy = h * 0.8;
	c.begin();
	c.moveTo(cx - shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	cx = w * 0.3;
	cy = h * 0.65;
	c.begin();
	c.moveTo(cx - shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	cx = w * 0.6;
	cy = h * 0.44;
	c.begin();
	c.moveTo(cx - shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	cx = w * 0.85;
	cy = h * 0.9;
	c.begin();
	c.moveTo(cx - shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	c.setFillColor(shapesColors[1]);
	cx = w * 0.08;
	cy = h * 0.65;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	cx = w * 0.58;
	cy = h * 0.85;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	cx = w * 0.72;
	cy = h * 0.92;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.5);
	c.lineTo(cx + shapeSize * 0.5, cy + shapeSize * 0.5);
	c.lineTo(cx - shapeSize * 0.5, cy + shapeSize * 0.5);
	c.close();
	c.fillAndStroke();

	c.setFillColor(shapesColors[2]);
	cx = w * 0.32;
	cy = h * 0.28;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.75);
	c.lineTo(cx + shapeSize * 0.75, cy);
	c.lineTo(cx, cy + shapeSize * 0.75);
	c.lineTo(cx - shapeSize * 0.75, cy);
	c.close();
	c.fillAndStroke();

	cx = w * 0.92;
	cy = h * 0.45;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.75);
	c.lineTo(cx + shapeSize * 0.75, cy);
	c.lineTo(cx, cy + shapeSize * 0.75);
	c.lineTo(cx - shapeSize * 0.75, cy);
	c.close();
	c.fillAndStroke();

	cx = w * 0.81;
	cy = h * 0.37;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.75);
	c.lineTo(cx + shapeSize * 0.75, cy);
	c.lineTo(cx, cy + shapeSize * 0.75);
	c.lineTo(cx - shapeSize * 0.75, cy);
	c.close();
	c.fillAndStroke();

	cx = w * 0.51;
	cy = h * 0.7;
	c.begin();
	c.moveTo(cx, cy - shapeSize * 0.75);
	c.lineTo(cx + shapeSize * 0.75, cy);
	c.lineTo(cx, cy + shapeSize * 0.75);
	c.lineTo(cx - shapeSize * 0.75, cy);
	c.close();
	c.fillAndStroke();

	c.setStrokeWidth(strokeWidth * 2);
	c.setStrokeColor(coordStroke);

	c.setShadow(false);
	c.begin();
	c.moveTo(0,0);
	c.lineTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupPlotChart.prototype.cst.SHAPE_PLOT_CHART, mxShapeMockupPlotChart);

//**********************************************************************************************************************************************************
//Gantt Chart
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupGanttChart(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
 * Extends mxShape.
 */
mxUtils.extend(mxShapeMockupGanttChart, mxShape);

mxShapeMockupGanttChart.prototype.cst = {
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		SHAPES_COLORS : 'fillColor2',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_GANTT_CHART : 'mxgraph.mockup.graphics.ganttChart'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupGanttChart.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupGanttChart.prototype.background = function(c, x, y, w, h, bgColor, frameColor)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupGanttChart.prototype.foreground = function(c, x, y, w, h)
{
	var shapesColors = mxUtils.getValue(this.style, mxShapeMockupGanttChart.prototype.cst.SHAPES_COLORS, '#888888,#bbbbbb').toString().split(',');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupGanttChart.prototype.cst.TEXT_COLOR, '#666666');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupGanttChart.prototype.cst.TEXT_SIZE, '#12');

	c.begin();
	c.moveTo(0, h * 0.13);
	c.lineTo(w, h * 0.13);
	c.moveTo(w * 0.4, 0);
	c.lineTo(w * 0.4, h);
	c.moveTo(w * 0.4, h * 0.065);
	c.lineTo(w, h * 0.065);
	c.moveTo(w * 0.03, 0);
	c.lineTo(w * 0.03, h * 0.13);
	c.moveTo(w * 0.1, 0);
	c.lineTo(w * 0.1, h * 0.13);
	c.moveTo(w * 0.315, 0);
	c.lineTo(w * 0.315, h * 0.13);
	c.moveTo(w * 0.45, h * 0.065);
	c.lineTo(w * 0.45, h * 0.13);
	c.moveTo(w * 0.5, h * 0.065);
	c.lineTo(w * 0.5, h);
	c.moveTo(w * 0.55, h * 0.065);
	c.lineTo(w * 0.55, h * 0.13);
	c.moveTo(w * 0.6, h * 0.065);
	c.lineTo(w * 0.6, h);
	c.moveTo(w * 0.65, h * 0.065);
	c.lineTo(w * 0.65, h * 0.13);
	c.moveTo(w * 0.7, h * 0.065);
	c.lineTo(w * 0.7, h);
	c.moveTo(w * 0.75, 0);
	c.lineTo(w * 0.75, h * 0.13);
	c.moveTo(w * 0.8, h * 0.065);
	c.lineTo(w * 0.8, h);
	c.moveTo(w * 0.85, h * 0.065);
	c.lineTo(w * 0.85, h * 0.13);
	c.moveTo(w * 0.9, h * 0.065);
	c.lineTo(w * 0.9, h);
	c.moveTo(w * 0.95, h * 0.065);
	c.lineTo(w * 0.95, h * 0.13);
	c.stroke();

	c.setFillColor(shapesColors[0]);
	c.begin();
	c.moveTo(w * 0.41, h * 0.15);
	c.lineTo(w * 0.64, h * 0.15);
	c.lineTo(w * 0.64, h * 0.18);
	c.lineTo(w * 0.625, h * 0.21);
	c.lineTo(w * 0.61, h * 0.18);
	c.lineTo(w * 0.44, h * 0.18);
	c.lineTo(w * 0.425, h * 0.21);
	c.lineTo(w * 0.41, h * 0.18);
	c.close();
	c.moveTo(w * 0.41, h * 0.24);
	c.lineTo(w * 0.49, h * 0.24);
	c.lineTo(w * 0.49, h * 0.275);
	c.lineTo(w * 0.41, h * 0.275);
	c.close();
	c.moveTo(w * 0.46, h * 0.31);
	c.lineTo(w * 0.64, h * 0.31);
	c.lineTo(w * 0.64, h * 0.345);
	c.lineTo(w * 0.46, h * 0.345);
	c.close();
	c.moveTo(w * 0.56, h * 0.39);
	c.lineTo(w * 0.69, h * 0.39);
	c.lineTo(w * 0.69, h * 0.425);
	c.lineTo(w * 0.56, h * 0.425);
	c.close();
	c.fill();

	c.setFillColor(shapesColors[1]);
	c.begin();
	c.moveTo(w * 0.46, h * 0.32);
	c.lineTo(w * 0.58, h * 0.32);
	c.lineTo(w * 0.58, h * 0.335);
	c.lineTo(w * 0.46, h * 0.335);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupGanttChart.prototype.cst.SHAPE_GANTT_CHART, mxShapeMockupGanttChart);

//**********************************************************************************************************************************************************
//Simple Icon
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupSimpleIcon(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupSimpleIcon, mxShape);

mxShapeMockupSimpleIcon.prototype.cst = {
		SIMPLE_ICON : 'mxgraph.mockup.graphics.simpleIcon'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupSimpleIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, h);
	c.moveTo(0, h);
	c.lineTo(w, 0);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupSimpleIcon.prototype.cst.SIMPLE_ICON, mxShapeMockupSimpleIcon);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupGraphicsAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupGraphicsAnchor, mxShape);

mxShapeMockupGraphicsAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.mockup.graphics.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupGraphicsAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeMockupGraphicsAnchor.prototype.cst.ANCHOR, mxShapeMockupGraphicsAnchor);

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupGraphicsRRect(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupGraphicsRRect, mxShape);

mxShapeMockupGraphicsRRect.prototype.cst = {
		RRECT : 'mxgraph.mockup.graphics.rrect',
		R_SIZE : 'rSize'
};

mxShapeMockupGraphicsRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupGraphicsRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupGraphicsRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupGraphicsRRect.prototype.cst.RRECT, mxShapeMockupGraphicsRRect);

