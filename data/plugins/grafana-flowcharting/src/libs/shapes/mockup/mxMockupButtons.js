/**
 * $Id: mxMockupButtons.js,v 1.8 2013/05/16 06:09:21 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Multiline Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupMultiButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupMultiButton, mxShape);

mxShapeMockupMultiButton.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_MULTILINE_BUTTON : 'mxgraph.mockup.buttons.multiButton',
		SUB_TEXT : 'subText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		BUTTON_STYLE : 'buttonStyle',
		ROUND : 'round',
		CHEVRON : 'chevron'
};

mxShapeMockupMultiButton.prototype.customProperties = [
	{name: 'buttonStyle', dispName: 'Style', type: 'enum', defVal:'round',
		enumList: [{val: 'round', dispName: 'Round'}, {val: 'chevron', dispName: 'Chevron'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupMultiButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupMultiButton.prototype.cst.MAIN_TEXT, 'Main Text');
	var subText = mxUtils.getValue(this.style, mxShapeMockupMultiButton.prototype.cst.SUB_TEXT, 'Sub Text');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupMultiButton.prototype.cst.TEXT_COLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupMultiButton.prototype.cst.TEXT_SIZE, '17');
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	c.setFontStyle(mxConstants.FONT_BOLD);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
	this.subText(c, x, y, w, h, subText, fontSize / 1.4, fontColor);
};

mxShapeMockupMultiButton.prototype.background = function(c, x, y, w, h)
{
	var buttonStyle = mxUtils.getValue(this.style, mxShapeMockupMultiButton.prototype.cst.BUTTON_STYLE, mxShapeMockupMultiButton.prototype.cst.ROUND).toString();
	var rSize = 10;
	c.begin();

	if (buttonStyle === mxShapeMockupMultiButton.prototype.cst.ROUND)
	{
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}
	else if (buttonStyle === mxShapeMockupMultiButton.prototype.cst.CHEVRON)
	{
		c.moveTo(0, h * 0.1);
		c.arcTo(w * 0.0372, h * 0.1111, 0, 0, 1, w * 0.0334, 0);
		c.lineTo(w * 0.768, 0);
		c.arcTo(w * 0.0722, h * 0.216, 0, 0, 1, w * 0.8014, h * 0.0399);
		c.lineTo(w * 0.99, h * 0.4585);
		c.arcTo(w * 0.09, h * 0.1, 0, 0, 1, w * 0.99, h * 0.5415);
		c.lineTo(w * 0.8014, h * 0.9568);
		c.arcTo(w * 0.0722, h * 0.216, 0, 0, 1, w * 0.768, h);
		c.lineTo(w * 0.0334, h);
		c.arcTo(w * 0.0372, h * 0.1111, 0, 0, 1, 0, h * 0.9);
	}

	c.close();	
	c.fillAndStroke();
};

mxShapeMockupMultiButton.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.4, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapeMockupMultiButton.prototype.subText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.text(w * 0.5, h * 0.7, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupMultiButton.prototype.cst.SHAPE_MULTILINE_BUTTON, mxShapeMockupMultiButton);

//**********************************************************************************************************************************************************
//Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupButton, mxShape);

mxShapeMockupButton.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_BUTTON : 'mxgraph.mockup.buttons.button',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		BUTTON_STYLE : 'buttonStyle',
		ROUND : 'round',
		CHEVRON : 'chevron'
};

mxShapeMockupButton.prototype.customProperties = [
	{name: 'buttonStyle', dispName: 'Style', type: 'enum', defVal:'round', 
		enumList: [{val: 'round', dispName: 'Round'}, {val: 'chevron', dispName: 'Chevron'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupButton.prototype.cst.MAIN_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupButton.prototype.cst.TEXT_COLOR, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupButton.prototype.cst.TEXT_SIZE, '17').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupButton.prototype.background = function(c, x, y, w, h)
{
	var buttonStyle = mxUtils.getValue(this.style, mxShapeMockupButton.prototype.cst.BUTTON_STYLE, mxShapeMockupButton.prototype.cst.ROUND).toString();
	var rSize = 10;
	c.begin();

	if (buttonStyle === mxShapeMockupButton.prototype.cst.ROUND)
	{
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}
	else if (buttonStyle === mxShapeMockupButton.prototype.cst.CHEVRON)
	{
		c.moveTo(0, h * 0.1);
		c.arcTo(w * 0.0372, h * 0.1111, 0, 0, 1, w * 0.0334, 0);
		c.lineTo(w * 0.768, 0);
		c.arcTo(w * 0.0722, h * 0.216, 0, 0, 1, w * 0.8014, h * 0.0399);
		c.lineTo(w * 0.99, h * 0.4585);
		c.arcTo(w * 0.09, h * 0.1, 0, 0, 1, w * 0.99, h * 0.5415);
		c.lineTo(w * 0.8014, h * 0.9568);
		c.arcTo(w * 0.0722, h * 0.216, 0, 0, 1, w * 0.768, h);
		c.lineTo(w * 0.0334, h);
		c.arcTo(w * 0.0372, h * 0.1111, 0, 0, 1, 0, h * 0.9);
	}

	c.close();	
	c.fillAndStroke();
};

mxShapeMockupButton.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.text(w / 2, h / 2, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupButton.prototype.cst.SHAPE_BUTTON, mxShapeMockupButton);

//**********************************************************************************************************************************************************
//Horizontal Button Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupHorButtonBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupHorButtonBar, mxShape);

mxShapeMockupHorButtonBar.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_HOR_BUTTON_BAR : 'mxgraph.mockup.buttons.horButtonBar',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2',
		STROKE_COLOR2 : 'strokeColor2',
		FILL_COLOR2 : 'fillColor2',
		SELECTED : '+',			//must be 1 char
		TEXT_SIZE : 'textSize'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupHorButtonBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.MAIN_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.TEXT_COLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.TEXT_COLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.TEXT_SIZE, '17').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.STROKE_COLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxShapeMockupHorButtonBar.prototype.cst.FILL_COLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var selectedButton = -1;
	var rSize = 10; //rounding size
	var labelOffset = 5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxShapeMockupHorButtonBar.prototype.cst.SELECTED)
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
	this.background(c, trueW, trueH, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton);
	c.setShadow(false);

	c.setFontStyle(mxConstants.FONT_BOLD);
	var currWidth = 0;

	for (var i = 0; i < buttonNum; i++)
	{
		if (i === selectedButton)
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

mxShapeMockupHorButtonBar.prototype.background = function(c, w, h, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton)
{
	c.begin();

	//draw the frame
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.fillAndStroke();

	//draw the button separators
	c.setStrokeColor(separatorColor);
	c.begin();
	for (var i = 1; i < buttonNum; i++)
	{
		if (i !== selectedButton && i !== (selectedButton + 1))
		{
			var currWidth = 0;

			for (var j = 0; j < i; j++)
			{
				currWidth += buttonWidths[j] + 2 * labelOffset;
			}

			currWidth = currWidth * w / minW;
			c.moveTo(currWidth, 0);
			c.lineTo(currWidth, h);
		}
	}

	c.stroke();

	//draw the selected button
	var buttonLeft = 0;
	c.setFillColor(selectedFillColor);

	for (var i = 0; i < selectedButton; i++)
	{
		buttonLeft += buttonWidths[i] + 2 * labelOffset;
	}

	buttonLeft = buttonLeft * w / minW;
	var buttonRight = (buttonWidths[selectedButton] + 2 * labelOffset) * w / minW;
	buttonRight += buttonLeft;

	if (selectedButton === 0)
	{
		c.begin();
		// we draw a path for the first button
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(buttonRight, 0);
		c.lineTo(buttonRight, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
		c.close();
		c.fill();
	}
	else if (selectedButton === buttonNum - 1)
	{
		c.begin();
		// we draw a path for the last button
		c.moveTo(buttonLeft, 0);
		c.lineTo(buttonRight - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, buttonRight, rSize);
		c.lineTo(buttonRight, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, buttonRight - rSize, h);
		c.lineTo(buttonLeft, h);
		c.close();
		c.fill();
	}
	else if (selectedButton !== -1)
	{
		c.begin();
		// we draw a path rectangle for one of the buttons in the middle
		c.moveTo(buttonLeft, 0);
		c.lineTo(buttonRight, 0);
		c.lineTo(buttonRight, h);
		c.lineTo(buttonLeft, h);
		c.close();
		c.fill();
	}

	//draw the frame again, to achieve a nicer effect
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.stroke();
};

mxShapeMockupHorButtonBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxShapeMockupHorButtonBar.prototype.cst.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupHorButtonBar.prototype.cst.SHAPE_HOR_BUTTON_BAR, mxShapeMockupHorButtonBar);

//**********************************************************************************************************************************************************
//Vertical Button Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupVerButtonBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupVerButtonBar, mxShape);

mxShapeMockupVerButtonBar.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_VER_BUTTON_BAR : 'mxgraph.mockup.buttons.verButtonBar',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2',
		STROKE_COLOR2 : 'strokeColor2',
		FILL_COLOR2 : 'fillColor2',
		SELECTED : '+',			//must be 1 char
		TEXT_SIZE : 'textSize'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupVerButtonBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.MAIN_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.TEXT_COLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.TEXT_COLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.TEXT_SIZE, '17').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.STROKE_COLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxShapeMockupVerButtonBar.prototype.cst.FILL_COLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var maxButtonWidth = 0;
	var selectedButton = -1;
	var rSize = 10; //rounding size
	var labelOffset = 5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxShapeMockupVerButtonBar.prototype.cst.SELECTED)
		{
			buttonText = textStrings[i].substring(1);
			selectedButton = i;
		}

		var currWidth = mxUtils.getSizeForString(buttonText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currWidth > maxButtonWidth)
		{
			maxButtonWidth = currWidth;
		}
	}

	var minButtonHeight =  fontSize * 1.5;
	var minH = buttonNum * minButtonHeight;
	var trueH = Math.max(h, minH);
	var minW = 2 * labelOffset + maxButtonWidth;
	var trueW = Math.max(w, minW);

	c.translate(x, y);

	this.background(c, trueW, trueH, rSize, buttonNum, labelOffset, buttonNum * minButtonHeight, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton, minButtonHeight);
	c.setShadow(false);

	var currWidth = 0;
	c.setFontStyle(mxConstants.FONT_BOLD);

	for (var i = 0; i < buttonNum; i++)
	{
		if (i === selectedButton)
		{
			c.setFontColor(selectedFontColor);
		}
		else
		{
			c.setFontColor(fontColor);
		}

		currWidth = currWidth + labelOffset;
		var currHeight = (i * minButtonHeight + minButtonHeight * 0.5) * trueH / minH;
		this.buttonText(c, trueW, currHeight, textStrings[i], fontSize);
	}
};

mxShapeMockupVerButtonBar.prototype.background = function(c, w, h, rSize, buttonNum, labelOffset, minH, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton, minButtonHeight)
{
	c.begin();

	//draw the frame
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.fillAndStroke();

	//draw the button separators
	c.setStrokeColor(separatorColor);
	c.begin();

	for (var i = 1; i < buttonNum; i++)
	{
		if (i !== selectedButton && i !== (selectedButton + 1))
		{
			var currHeight = i * minButtonHeight * h / minH;

			c.moveTo(0, currHeight);
			c.lineTo(w, currHeight);
		}
	}

	c.stroke();

	//draw the selected button
	c.setFillColor(selectedFillColor);

	if (selectedButton === 0)
	{
		// we draw a path for the first button
		c.begin();
		var buttonBottom = minButtonHeight * h / minH;
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, buttonBottom);
		c.lineTo(0, buttonBottom);
		c.close();
		c.fill();
	}
	else if (selectedButton === buttonNum - 1)
	{
		// we draw a path for the last button
		c.begin();
		var buttonTop = h - minButtonHeight * h / minH;
		c.moveTo(0, buttonTop);
		c.lineTo(w, buttonTop);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
		c.close();
		c.fill();
	}
	else if (selectedButton !== -1)
	{
		// we draw a path rectangle for one of the buttons in the middle
		c.begin();
		var buttonTop = minButtonHeight * selectedButton * h / minH;
		var buttonBottom = minButtonHeight * (selectedButton + 1) * h / minH;
		c.moveTo(0, buttonTop);
		c.lineTo(w, buttonTop);
		c.lineTo(w, buttonBottom);
		c.lineTo(0, buttonBottom);
		c.close();
		c.fill();
	}

//	//draw the frame again, to achieve a nicer effect
	c.begin();
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.stroke();
};

mxShapeMockupVerButtonBar.prototype.buttonText = function(c, w, h, textString, fontSize)
{
	if(textString.charAt(0) === mxShapeMockupVerButtonBar.prototype.cst.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w * 0.5), h, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupVerButtonBar.prototype.cst.SHAPE_VER_BUTTON_BAR, mxShapeMockupVerButtonBar);

//**********************************************************************************************************************************************************
//On-Off Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupOnOffButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupOnOffButton, mxShape);

mxShapeMockupOnOffButton.prototype.cst = {
		SHAPE_ON_OFF_BUTTON : 'mxgraph.mockup.buttons.onOffButton',
		BUTTON_STATE : 'buttonState',
		STATE_ON : 'on',
		STATE_OFF : 'off',
		FILL_COLOR2 : 'fillColor2',
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize'
};

mxShapeMockupOnOffButton.prototype.customProperties = [
	{name: 'buttonState', dispName: 'Button State', type: 'enum',
		enumList: [{val: 'on', dispName: 'On'}, {val: 'off', dispName: 'Off'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupOnOffButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	w = Math.max(w, 10);
	h = Math.max(h, 10);

	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupOnOffButton.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w, h, 10, 10);
	c.fillAndStroke();

};

mxShapeMockupOnOffButton.prototype.foreground = function(c, x, y, w, h)
{
	var state = mxUtils.getValue(this.style, mxShapeMockupOnOffButton.prototype.cst.BUTTON_STATE, mxShapeMockupOnOffButton.prototype.cst.STATE_ON);
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupOnOffButton.prototype.cst.FILL_COLOR2, '#008cff');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupOnOffButton.prototype.cst.TEXT_COLOR, '#ffffff,#999999').toString().split(',');
	var mainText = mxUtils.getValue(this.style, mxShapeMockupOnOffButton.prototype.cst.MAIN_TEXT, 'ON,OFF').toString().split(',');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupOnOffButton.prototype.cst.TEXT_SIZE, '17');

	if (state === mxShapeMockupOnOffButton.prototype.cst.STATE_ON)
	{
		c.setFillColor(fillColor2);
		c.setFontColor(textColor[0]);
		c.roundrect(0, 0, w * 0.75, h, 10, 10);
	}
	else
	{
		c.setFontColor(textColor[1]);
		c.roundrect(w * 0.25, 0, w * 0.75, h, 10, 10);
	}

	c.fillAndStroke();
	c.setFontSize(textSize);
	c.setFontStyle(mxConstants.FONT_BOLD);

	if(state === mxShapeMockupOnOffButton.prototype.cst.STATE_ON)
	{
		c.text(w * 0.375, h * 0.5, 0, 0, mainText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (state === mxShapeMockupOnOffButton.prototype.cst.STATE_OFF)
	{
		c.text(w * 0.625, h * 0.5, 0, 0, mainText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupOnOffButton.prototype.cst.SHAPE_ON_OFF_BUTTON, mxShapeMockupOnOffButton);

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupRRect, mxShape);

mxShapeMockupRRect.prototype.cst = {
		RRECT : 'mxgraph.mockup.rrect',
		R_SIZE : 'rSize'
};

mxShapeMockupRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupRRect.prototype.cst.RRECT, mxShapeMockupRRect);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupAnchor, mxShape);

mxShapeMockupAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.mockup.anchor'
};

mxShapeMockupAnchor.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeMockupAnchor.prototype.cst.ANCHOR, mxShapeMockupAnchor);

//**********************************************************************************************************************************************************
//Top Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupTopButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupTopButton, mxShape);

mxShapeMockupTopButton.prototype.cst = {
		TOP_BUTTON : 'mxgraph.mockup.topButton',
		R_SIZE : 'rSize'
};

mxShapeMockupTopButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupTopButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupTopButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupTopButton.prototype.cst.TOP_BUTTON, mxShapeMockupTopButton);

//**********************************************************************************************************************************************************
//Bottom Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupBottomButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupBottomButton, mxShape);

mxShapeMockupBottomButton.prototype.cst = {
		BOTTOM_BUTTON : 'mxgraph.mockup.bottomButton',
		R_SIZE : 'rSize'
};

mxShapeMockupBottomButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupBottomButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupBottomButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupBottomButton.prototype.cst.BOTTOM_BUTTON, mxShapeMockupBottomButton);

//**********************************************************************************************************************************************************
//Right Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupRightButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupRightButton, mxShape);

mxShapeMockupRightButton.prototype.cst = {
		RIGHT_BUTTON : 'mxgraph.mockup.rightButton',
		R_SIZE : 'rSize'
};

mxShapeMockupRightButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupRightButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupRightButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupRightButton.prototype.cst.RIGHT_BUTTON, mxShapeMockupRightButton);

//**********************************************************************************************************************************************************
//Left Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupLeftButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupLeftButton, mxShape);

mxShapeMockupLeftButton.prototype.cst = {
		LEFT_BUTTON : 'mxgraph.mockup.leftButton',
		R_SIZE : 'rSize'
};

mxShapeMockupLeftButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupLeftButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupLeftButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupLeftButton.prototype.cst.LEFT_BUTTON, mxShapeMockupLeftButton);

