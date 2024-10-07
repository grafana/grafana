/**
 * $Id: mxMockupNavigation.js,v 1.5 2014/01/21 13:11:15 gaudenz Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Breadcrumb (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupBreadcrumb(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupBreadcrumb, mxShape);

mxShapeMockupBreadcrumb.prototype.cst = {
		SHAPE_BREADCRUMB : 'mxgraph.mockup.navigation.breadcrumb',
		MAIN_TEXT : 'mainText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupBreadcrumb.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupBreadcrumb.prototype.cst.MAIN_TEXT, 'Layer 1, Layer 2, Layer 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupBreadcrumb.prototype.cst.TEXT_COLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxShapeMockupBreadcrumb.prototype.cst.TEXT_COLOR2, '#008cff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupBreadcrumb.prototype.cst.TEXT_SIZE, '17').toString();
	var separatorColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#c4c4c4');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var labelOffset = 10;

	for (var i = 0; i < buttonNum; i++)
	{
		buttonWidths[i] = mxUtils.getSizeForString(textStrings[i], fontSize, mxConstants.DEFAULT_FONTFAMILY).width;
		buttonTotalWidth += buttonWidths[i];
	}

	var trueH = Math.max(h, fontSize * 1.5, 20);
	var minW = 2 * labelOffset * buttonNum + buttonTotalWidth;
	var trueW = Math.max(w, minW);
	c.translate(x, y);
	c.setShadow(false);

	this.separators(c, trueW, trueH, buttonNum, buttonWidths, labelOffset, minW, separatorColor);
	var currWidth = 0;

	for (var i = 0; i < buttonNum; i++)
	{
		if (i + 1 === buttonNum)
		{
			c.setFontColor(selectedFontColor);
		}
		else
		{
			c.setFontColor(fontColor);
		}

		currWidth = currWidth + labelOffset;
		this.buttonText(c, currWidth, trueH, textStrings[i], buttonWidths[i], fontSize, minW, trueW);
		currWidth = currWidth + buttonWidths[i] + labelOffset;
	}
};

mxShapeMockupBreadcrumb.prototype.separators = function(c, w, h, buttonNum, buttonWidths, labelOffset, minW, separatorColor)
{
	//draw the button separators
	c.setStrokeColor(separatorColor);
	var midY = h * 0.5;
	var size = 5;
	c.begin();

	for (var i = 1; i < buttonNum; i++)
	{
		var currWidth = 0;

		for (var j = 0; j < i; j++)
		{
			currWidth += buttonWidths[j] + 2 * labelOffset;
		}

		currWidth = currWidth * w / minW;
		c.moveTo(currWidth - size * 0.5, midY - size);
		c.lineTo(currWidth + size * 0.5, midY);
		c.lineTo(currWidth - size * 0.5, midY + size);
	}
	c.stroke();
};

mxShapeMockupBreadcrumb.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupBreadcrumb.prototype.cst.SHAPE_BREADCRUMB, mxShapeMockupBreadcrumb);

//**********************************************************************************************************************************************************
//Step Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupStepBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupStepBar, mxShape);

mxShapeMockupStepBar.prototype.cst = {
		SHAPE_STEP_BAR : 'mxgraph.mockup.navigation.stepBar',
		SELECTED : '+',			//must be 1 char
		MAIN_TEXT : 'mainText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2'
};

mxShapeMockupStepBar.prototype.customProperties = [
	{name: 'mainText', dispName: 'Text', type: 'string'},
	{name: 'textSize', dispName: 'Text Size', type: 'float'},
	{name: 'textColor', dispName: 'Text Color', type: 'color'},
	{name: 'textColor2', dispName: 'Text2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupStepBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupStepBar.prototype.cst.MAIN_TEXT, 'Step 1, Step 2, Step 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupStepBar.prototype.cst.TEXT_COLOR, '#666666');
	var currColor = mxUtils.getValue(this.style, mxShapeMockupStepBar.prototype.cst.TEXT_COLOR2, '#008cff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupStepBar.prototype.cst.TEXT_SIZE, '17').toString();
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#c4c4c4');
	var doneColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#666666');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var labelOffset = 10;
	var selectedButton = -1;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxShapeMockupStepBar.prototype.cst.SELECTED)
		{
			buttonText = textStrings[i].substring(1);
			selectedButton = i;
		}

		buttonWidths[i] = mxUtils.getSizeForString(buttonText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		buttonTotalWidth += buttonWidths[i];
	}

	var trueH = Math.max(h, fontSize * 1.5, 20);
	var minW = 2 * labelOffset * buttonNum + buttonTotalWidth;
	var trueW = Math.max(w, minW);
	c.translate(x, y);

	this.stepLineBg(c, trueW, trueH, buttonNum, buttonWidths, labelOffset, minW, bgColor, fontSize, trueW);
	c.setShadow(false);

	this.stepLineFg(c, trueW, trueH, buttonNum, buttonWidths, labelOffset, minW, bgColor, doneColor, currColor, fontSize, trueW, selectedButton);
	var currWidth = 0;

	for (var i = 0; i < buttonNum; i++)
	{
		if (i >= selectedButton)
		{
			c.setFontColor(currColor);
		}
		else
		{
			c.setFontColor(fontColor);
		}

		currWidth = currWidth + labelOffset;
		this.buttonText(c, currWidth, trueH, textStrings[i], buttonWidths[i], fontSize, minW, trueW);
		currWidth = currWidth + buttonWidths[i] + labelOffset;
	}
};

mxShapeMockupStepBar.prototype.stepLineBg = function(c, w, h, buttonNum, buttonWidths, labelOffset, minW, bgColor, fontSize, trueW)
{
	//draw the button separators
	c.setStrokeColor(bgColor);
	c.setFillColor(bgColor);
	var midY = fontSize * 2;
	var size = 10;
	var startX = 0;
	var endX = 0;

	for (var i = 0; i < buttonNum; i++)
	{
		var currWidth = 0;

		for (var j = 0; j < i; j++)
		{
			currWidth += buttonWidths[j] + 2 * labelOffset;
		}

		currWidth += buttonWidths[i] * 0.5 + labelOffset;

		currWidth = currWidth * w / minW;

		if (i === 0)
		{
			startX = currWidth;	
		}
		else if (i + 1 === buttonNum)
		{
			endX = currWidth;
		}

		c.begin();
		c.ellipse(currWidth - size, midY - size, 2 * size, 2 * size);
		c.fillAndStroke();
	}

	c.begin();
	c.rect(startX, midY - size * 0.2, endX - startX, size * 0.4);
	c.fillAndStroke();
};

mxShapeMockupStepBar.prototype.stepLineFg = function(c, w, h, buttonNum, buttonWidths, labelOffset, minW, bgColor, doneColor, currColor, fontSize, trueW, selectedButton)
{
	//draw the button separators
	c.setStrokeColor(doneColor);
	var midY = fontSize * 2;
	var size = 10 * 0.75;
	var startX = 0;
	var endX = 0;
	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');

	for (var i = 0; i <= selectedButton; i++)
	{
		var currWidth = 0;

		for (var j = 0; j < i; j++)
		{
			currWidth += buttonWidths[j] + 2 * labelOffset;
		}

		currWidth += buttonWidths[i] * 0.5 + labelOffset;

		currWidth = currWidth * w / minW;

		if (i === 0)
		{
			startX = currWidth;	
		}
		else if (i === selectedButton)
		{
			endX = currWidth;
		}
	}
	
	c.setFillColor(doneColor);
	c.begin();
	c.rect(startX, midY - size * 0.15, endX - startX, size * 0.3);
	c.fill();
	c.setFillColor(bgColor);

	for (var i = 0; i <= selectedButton; i++)
	{
		var currWidth = 0;

		for (var j = 0; j < i; j++)
		{
			currWidth += buttonWidths[j] + 2 * labelOffset;
		}

		currWidth += buttonWidths[i] * 0.5 + labelOffset;

		currWidth = currWidth * w / minW;

		if (i === 0)
		{
			startX = currWidth;	
		}
		else if (i + 1 === selectedButton)
		{
			endX = currWidth;
		}

		if (i < selectedButton)
		{
			c.setStrokeWidth(strokeWidth);
			c.begin();
			c.ellipse(currWidth - size, midY - size, 2 * size, 2 * size);
			c.fillAndStroke();

			c.setStrokeWidth(strokeWidth * 0.5);
			c.begin();
			c.ellipse(currWidth - size * 0.6, midY - size * 0.6, 2 * size * 0.6, 2 * size * 0.6);
			c.fillAndStroke();
		}
		else
		{
			c.setStrokeWidth(strokeWidth);
			c.setFillColor(bgColor);
			c.setStrokeColor(bgColor);
			c.begin();
			c.ellipse(currWidth - size / 0.75, midY - size / 0.75, 2 * size / 0.75, 2 * size / 0.75);
			c.fillAndStroke();

			c.setStrokeWidth(strokeWidth);
			c.setFillColor('#ffffff');
			c.setStrokeColor('#ffffff');
			c.begin();
			c.ellipse(currWidth - size, midY - size, 2 * size, 2 * size);
			c.fillAndStroke();

			c.setFillColor(currColor);
			c.setStrokeColor(currColor);
			c.setStrokeWidth(strokeWidth * 0.5);
			c.begin();
			c.ellipse(currWidth - size * 0.7, midY - size * 0.7, 2 * size * 0.7, 2 * size * 0.7);
			c.fillAndStroke();
		}
	}
};

mxShapeMockupStepBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxShapeMockupStepBar.prototype.cst.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, fontSize * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupStepBar.prototype.cst.SHAPE_STEP_BAR, mxShapeMockupStepBar);

//**********************************************************************************************************************************************************
//Cover Flow
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupCoverFlow(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCoverFlow, mxShape);

mxShapeMockupCoverFlow.prototype.cst = {
		SHAPE_COVER_FLOW : 'mxgraph.mockup.navigation.coverFlow'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupCoverFlow.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(w * 0.0924, h * 0.07);
	c.lineTo(w * 0.005, h * 0.01);
	c.lineTo(w * 0.005, h * 0.99);
	c.lineTo(w * 0.0924, h * 0.93);

	c.moveTo(w * 0.1774, h * 0.09);
	c.lineTo(w * 0.0924, h * 0.01);
	c.lineTo(w * 0.0924, h * 0.99);
	c.lineTo(w * 0.1774, h * 0.91);

	c.moveTo(w * 0.3373, h * 0.22);
	c.lineTo(w * 0.1774, h * 0.01);
	c.lineTo(w * 0.1774, h * 0.99);
	c.lineTo(w * 0.3373, h * 0.78);

	c.moveTo(w * 0.912, h * 0.07);
	c.lineTo(w * 0.998, h * 0.01);
	c.lineTo(w * 0.998, h * 0.99);
	c.lineTo(w * 0.912, h * 0.93);

	c.moveTo(w * 0.8271, h * 0.09);
	c.lineTo(w * 0.912, h * 0.01);
	c.lineTo(w * 0.912, h * 0.99);
	c.lineTo(w * 0.8271, h * 0.91);

	c.moveTo(w * 0.6672, h * 0.22);
	c.lineTo(w * 0.8271, h * 0.01);
	c.lineTo(w * 0.8271, h * 0.99);
	c.lineTo(w * 0.6672, h * 0.78);

	c.moveTo(w * 0.3373, h * 0.005);
	c.lineTo(w * 0.3373, h * 0.995);
	c.lineTo(w * 0.6672, h * 0.995);
	c.lineTo(w * 0.6672, h * 0.005);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupCoverFlow.prototype.cst.SHAPE_COVER_FLOW, mxShapeMockupCoverFlow);

//**********************************************************************************************************************************************************
//Scroll Bar
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupScrollBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupScrollBar, mxShape);

mxShapeMockupScrollBar.prototype.cst = {
		SHAPE_SCROLL_BAR : 'mxgraph.mockup.navigation.scrollBar',
		FILL_COLOR2 : 'fillColor2',
		STROKE_COLOR2 : 'strokeColor2',
		BAR_POS : 'barPos'
};

mxShapeMockupScrollBar.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float'},
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'},
	{name: 'strokeColor2', dispName: 'Stroke2 Color', type: 'color'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupScrollBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	h = 20;
	var buttonX = 20;
	w = Math.max(w, 2 * buttonX);
	
	c.translate(x, y);
	this.background(c, w, h, buttonX);
	c.setShadow(false);
	this.foreground(c, w, h, buttonX);
	this.barPos = 20;
};

mxShapeMockupScrollBar.prototype.background = function(c, w, h, buttonX)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
	c.begin();
	c.moveTo(buttonX, 0);
	c.lineTo(buttonX, h);
	c.moveTo(w - buttonX, 0);
	c.lineTo(w - buttonX, h);
	c.stroke();
}

mxShapeMockupScrollBar.prototype.foreground = function(c, w, h, buttonX)
{
	var barPos = mxUtils.getValue(this.style, mxShapeMockupScrollBar.prototype.cst.BAR_POS, '20');
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupScrollBar.prototype.cst.FILL_COLOR2, '#99ddff');
	var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupScrollBar.prototype.cst.STROKE_COLOR2, 'none');
	
	barPos = Math.max(0, barPos);
	barPos = Math.min(100, barPos);
	
	c.setStrokeColor(strokeColor2);
	c.setFillColor(fillColor2);
	
	c.begin();
	c.moveTo(buttonX * 0.2, h * 0.5);
	c.lineTo(buttonX * 0.8, h * 0.2);
	c.lineTo(buttonX * 0.8, h * 0.8);
	c.close();
	c.moveTo(w - buttonX * 0.2, h * 0.5);
	c.lineTo(w - buttonX * 0.8, h * 0.2);
	c.lineTo(w - buttonX * 0.8, h * 0.8);
	c.close();
	c.fillAndStroke();

	//draw the handle based on arg.barPos
	var barWidth = 60;
	var barMin = buttonX;
	var barMax = w - buttonX;
	barWidth = Math.min(barWidth, barMax - barMin);
	var barCenterMin = barMin + barWidth / 2;
	var barCenterMax = barMax - barWidth / 2;
	var barCenterRange = barCenterMax - barCenterMin;
	var barCenterPos = barCenterRange * barPos / 100;
	var barStart = barMin + barCenterPos;

	c.roundrect(barStart, h * 0.15, barWidth, h * 0.7, 5, 5);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupScrollBar.prototype.cst.SHAPE_SCROLL_BAR, mxShapeMockupScrollBar);

Graph.handleFactory[mxShapeMockupScrollBar.prototype.cst.SHAPE_SCROLL_BAR] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'barPos', this.barPos))));

				return new mxPoint(bounds.x + ((bounds.width - 100) * barPos / bounds.width) / 100 * bounds.width + 50, bounds.y + 10);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x - 50) * 100 / (bounds.width - 100)))) / 1000;
			})];

	return handles;
}

//**********************************************************************************************************************************************************
//Pagination
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupPagination(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupPagination, mxShape);

mxShapeMockupPagination.prototype.cst = {
		MAIN_TEXT : 'linkText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SHAPE_PAGINATION : 'mxgraph.mockup.navigation.pagination'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupPagination.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupPagination.prototype.cst.MAIN_TEXT, '0-9 A B C D E F G H I J K L M N O P Q R S T U V X Y Z');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupPagination.prototype.cst.TEXT_SIZE, '17');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupPagination.prototype.cst.TEXT_COLOR, '#0000ff');

	c.translate(x, y);
	var width = mxUtils.getSizeForString(mainText, textSize, mxConstants.DEFAULT_FONTFAMILY).width;
	c.setStrokeColor(textColor);
	c.setFontSize(textSize);
	c.setFontColor(textColor);
	c.text(w * 0.5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.begin();
	c.moveTo(w * 0.5 - width * 0.5, (h + parseInt(textSize, 10)) * 0.5);
	c.lineTo(w * 0.5 + width * 0.5, (h + parseInt(textSize, 10)) * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupPagination.prototype.cst.SHAPE_PAGINATION, mxShapeMockupPagination);

//**********************************************************************************************************************************************************
//Page Control
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupPageControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupPageControl, mxShape);

mxShapeMockupPageControl.prototype.cst = {
		SHAPE_PAGE_CONTROL : 'mxgraph.mockup.navigation.pageControl'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupPageControl.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);


	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#000000');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	var rSize = Math.min(h * 0.5, w * 0.05);
	c.setFillColor(strokeColor);
	c.ellipse(0, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.setFillColor(fillColor);
	c.ellipse(w * 0.35 - rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w * 0.65 - rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w - 2 * rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupPageControl.prototype.cst.SHAPE_PAGE_CONTROL, mxShapeMockupPageControl);

//**********************************************************************************************************************************************************
//Map Navigator
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupMapNavigator(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupMapNavigator, mxShape);

mxShapeMockupMapNavigator.prototype.cst = {
		SHAPE_MAP_NAVIGATOR : 'mxgraph.mockup.navigation.mapNavigator',
		FILL_COLOR2 : 'fillColor2',
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3'
};

mxShapeMockupMapNavigator.prototype.customProperties = [
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'},
	{name: 'strokeColor2', dispName: 'Stroke2 Color', type: 'color'},
	{name: 'strokeColor3', dispName: 'Stroke3 Color', type: 'color'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupMapNavigator.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupMapNavigator.prototype.background = function(c, w, h)
{
	c.ellipse(0, 0, w, h * 0.6);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.35, h * 0.584);
	c.lineTo(w * 0.35, h * 0.95);
	c.arcTo(w * 0.083, h * 0.05, 0, 0, 0, w * 0.43, h);
	c.lineTo(w * 0.56, h);
	c.arcTo(w * 0.083, h * 0.05, 0, 0, 0, w * 0.65, h * 0.95);
	c.lineTo(w * 0.65, h * 0.584);
	c.fillAndStroke();
}

mxShapeMockupMapNavigator.prototype.foreground = function(c, w, h)
{
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupMapNavigator.prototype.cst.FILL_COLOR2, '#99ddff');
	var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupMapNavigator.prototype.cst.STROKE_COLOR2, 'none');
	var strokeColor3 = mxUtils.getValue(this.style, mxShapeMockupMapNavigator.prototype.cst.STROKE_COLOR3, '#ffffff');

	c.setFillColor(fillColor2);
	c.setStrokeColor(strokeColor2);
	c.ellipse(w * 0.4, h * 0.65, w * 0.2, h * 0.12);
	c.fillAndStroke();
	c.ellipse(w * 0.4, h * 0.85, w * 0.2, h * 0.12);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.1806, h * 0.34);
	c.lineTo(w * 0.1357, h * 0.366);
	c.lineTo(w * 0.0228, h * 0.3);
	c.lineTo(w * 0.1357, h * 0.234);
	c.lineTo(w * 0.1806, h * 0.26);
	c.lineTo(w * 0.1142, h * 0.3);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.433, h * 0.108);
	c.lineTo(w * 0.3881, h * 0.08);
	c.lineTo(w * 0.4994, h * 0.012);
	c.lineTo(w * 0.6123, h * 0.08);
	c.lineTo(w * 0.5658, h * 0.108);
	c.lineTo(w * 0.4994, h * 0.068);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8198, h * 0.262);
	c.lineTo(w * 0.868, h * 0.233);
	c.lineTo(w * 0.9776, h * 0.3);
	c.lineTo(w * 0.868, h * 0.367);
	c.lineTo(w * 0.8198, h * 0.341);
	c.lineTo(w * 0.8863, h * 0.3);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5641, h * 0.493);
	c.lineTo(w * 0.6123, h * 0.522);
	c.lineTo(w * 0.4994, h * 0.588);
	c.lineTo(w * 0.3881, h * 0.521);
	c.lineTo(w * 0.4363, h * 0.493);
	c.lineTo(w * 0.4994, h * 0.533);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.3333, h * 0.32);
	c.lineTo(w * 0.3333, h * 0.28);
	c.lineTo(w * 0.4163, h * 0.3);
	c.close();
	c.moveTo(w * 0.4662, h * 0.2);
	c.lineTo(w * 0.5326, h * 0.2);
	c.lineTo(w * 0.4994, h * 0.25);
	c.close()
	c.moveTo(w * 0.6654, h * 0.28);
	c.lineTo(w * 0.6654, h * 0.32);
	c.lineTo(w * 0.5824, h * 0.3);
	c.close();
	c.moveTo(w * 0.5326, h * 0.4);
	c.lineTo(w * 0.4662, h * 0.4);
	c.lineTo(w * 0.4994, h * 0.35);
	c.close();
	c.fillAndStroke();
	
	c.setStrokeWidth(2);
	c.setStrokeColor(strokeColor3);
	
	c.begin();
	c.moveTo(w * 0.5, h * 0.67);
	c.lineTo(w * 0.5, h * 0.75);
	c.moveTo(w * 0.43, h * 0.71);
	c.lineTo(w * 0.57, h * 0.71);
	c.moveTo(w * 0.43, h * 0.91);
	c.lineTo(w * 0.57, h * 0.91);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupMapNavigator.prototype.cst.SHAPE_MAP_NAVIGATOR, mxShapeMockupMapNavigator);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupNavigationAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupNavigationAnchor, mxShape);

mxShapeMockupNavigationAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.mockup.navigation.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupNavigationAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeMockupNavigationAnchor.prototype.cst.ANCHOR, mxShapeMockupNavigationAnchor);

