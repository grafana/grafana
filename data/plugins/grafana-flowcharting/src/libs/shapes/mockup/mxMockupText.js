/**
 * $Id: mxMockupText.js,v 1.4 2013/05/24 07:12:36 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Link
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupLink(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupLink, mxShape);

mxShapeMockupLink.prototype.cst = {
		LINK_TEXT : 'linkText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SHAPE_LINK : 'mxgraph.mockup.text.link'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupLink.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var linkText = mxUtils.getValue(this.style, mxShapeMockupLink.prototype.cst.LINK_TEXT, 'Link');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupLink.prototype.cst.TEXT_SIZE, '17');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupLink.prototype.cst.TEXT_COLOR, '#0000ff');

	c.translate(x, y);
	var width = mxUtils.getSizeForString(linkText, textSize, mxConstants.DEFAULT_FONTFAMILY).width;
	c.setStrokeColor(textColor);
	c.setFontSize(textSize);
	c.setFontColor(textColor);

	c.text(w * 0.5, h * 0.5, 0, 0, linkText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.begin();
	c.moveTo(w * 0.5 - width * 0.5, (h + parseInt(textSize, 10)) * 0.5);
	c.lineTo(w * 0.5 + width * 0.5, (h + parseInt(textSize, 10)) * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupLink.prototype.cst.SHAPE_LINK, mxShapeMockupLink);

//**********************************************************************************************************************************************************
//Link Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupLinkBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupLinkBar, mxShape);

mxShapeMockupLinkBar.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_LINK_BAR : 'mxgraph.mockup.text.linkBar',
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
mxShapeMockupLinkBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.MAIN_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.TEXT_COLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.TEXT_COLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.TEXT_SIZE, '17').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.STROKE_COLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxShapeMockupLinkBar.prototype.cst.FILL_COLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var selectedButton = -1;
	var rSize = 10; //rounding size
	var labelOffset = 5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxShapeMockupLinkBar.prototype.cst.SELECTED)
		{
			buttonText = textStrings[i].substring(1);
			selectedButton = i;
		}

		var currW = mxUtils.getSizeForString(buttonText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currW === 0)
		{
			buttonWidths[i] = 42;
		}
		else
		{
			buttonWidths[i] = currW;
		}

		buttonTotalWidth += buttonWidths[i];
	}

	var trueH = Math.max(h, fontSize * 1.5, 20);
	var minW = 2 * labelOffset * buttonNum + buttonTotalWidth;
	var trueW = Math.max(w, minW);

	c.translate(x, y);
	this.background(c, trueW, trueH, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton);
	c.setShadow(false);

	var currWidth = 0;

	for (var i = 0; i < buttonNum; i++)
	{
		if (i === selectedButton)
		{
			c.setFontColor(selectedFontColor);
			c.setStrokeColor(selectedFontColor);
		}
		else
		{
			c.setFontColor(fontColor);
			c.setStrokeColor(fontColor);
		}

		currWidth = currWidth + labelOffset;
		this.buttonText(c, currWidth, trueH, textStrings[i], buttonWidths[i], fontSize, minW, trueW);
		currWidth = currWidth + buttonWidths[i] + labelOffset;
	}
};

mxShapeMockupLinkBar.prototype.background = function(c, w, h, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton)
{
	c.begin();

	//draw the frame
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.rect(0, 0, w, h);
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
		c.rect(0, 0, buttonRight, h);
		c.fill();
	}
	else if (selectedButton === buttonNum - 1)
	{
		c.rect(buttonLeft, 0, buttonRight - buttonLeft, h);
		c.fill();
	}
	else if (selectedButton !== -1)
	{
		c.rect(buttonLeft, 0, buttonRight - buttonLeft, h);
		c.fill();
	}

	//draw the frame again, to achieve a nicer effect
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.rect(0, 0, w, h);
	c.stroke();
};

mxShapeMockupLinkBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxShapeMockupLinkBar.prototype.cst.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var textW = mxUtils.getSizeForString(textString, fontSize, mxConstants.DEFAULT_FONTFAMILY).width * 0.5;

	if (textString !== null && textString !== '')
	{
		c.begin();
		c.moveTo((w + buttonWidth * 0.5) * trueW / minW - textW, h * 0.5 + fontSize * 0.5);
		c.lineTo((w + buttonWidth * 0.5) * trueW / minW + textW, h * 0.5 + fontSize * 0.5);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapeMockupLinkBar.prototype.cst.SHAPE_LINK_BAR, mxShapeMockupLinkBar);

//**********************************************************************************************************************************************************
//Callout
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupCallout(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCallout, mxShape);

mxShapeMockupCallout.prototype.cst = {
		CALLOUT_TEXT : 'linkText',
		CALLOUT_DIR : 'callDir',
		CALLOUT_STYLE : 'callStyle',
		STYLE_LINE : 'line',
		STYLE_RECT : 'rect',
		STYLE_ROUNDRECT : 'roundRect',
		DIR_NW : 'NW',
		DIR_NE : 'NE',
		DIR_SE : 'SE',
		DIR_SW : 'SW',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SHAPE_CALLOUT : 'mxgraph.mockup.text.callout'
};

mxShapeMockupCallout.prototype.customProperties = [
	{name: 'callDir', dispName: 'Direction', type: 'enum',
		enumList:[{val: 'NW', dispName:'North-West'},
			      {val: 'NE', dispName:'North-East'},
			      {val: 'SE', dispName:'South-East'},
			      {val: 'SW', dispName:'South-West'}]},
	{name: 'callStyle', dispName: 'Style', type: 'enum',
		enumList:[{val: 'line', dispName:'Line'},
			      {val: 'rect', dispName:'Rectangle'}]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupCallout.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var calloutText = mxUtils.getValue(this.style, mxShapeMockupCallout.prototype.cst.CALLOUT_TEXT, 'Callout');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupCallout.prototype.cst.TEXT_SIZE, '17');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupCallout.prototype.cst.TEXT_COLOR, '#666666');
	var callStyle = mxUtils.getValue(this.style, mxShapeMockupCallout.prototype.cst.CALLOUT_STYLE, mxShapeMockupCallout.prototype.cst.STYLE_LINE);
	var callDir = mxUtils.getValue(this.style, mxShapeMockupCallout.prototype.cst.CALLOUT_DIR, mxShapeMockupCallout.prototype.cst.DIR_NW);
	var textWidth = mxUtils.getSizeForString(calloutText, textSize, mxConstants.DEFAULT_FONTFAMILY).width;
	textWidth = textWidth * 1.2;

	if (textWidth == 0)
	{
		textWidth = 70;
	}

	c.translate(x, y);
	c.setFontSize(textSize);
	c.setFontColor(textColor);
	var callH = textSize * 1.5; 

	if (callDir === mxShapeMockupCallout.prototype.cst.DIR_NW)
	{
		if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_LINE)
		{
			c.begin();
			c.moveTo(0, callH);
			c.lineTo(textWidth, callH);
			c.lineTo(w, h);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_RECT)
		{
			c.rect(0,0, textWidth, callH);
			c.fillAndStroke();
			c.begin();
			c.moveTo(textWidth * 0.5, callH);
			c.lineTo(w, h);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_ROUNDRECT)
		{
			c.roundrect(0, 0, textWidth, callH, callH * 0.25, callH * 0.25);
			c.fillAndStroke();
			c.begin();
			c.moveTo(textWidth * 0.5, callH);
			c.lineTo(w, h);
			c.stroke();
		}

		c.text(textWidth * 0.5, callH * 0.5, 0, 0, calloutText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (callDir === mxShapeMockupCallout.prototype.cst.DIR_NE)
	{
		if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_LINE)
		{
			c.begin();
			c.moveTo(w, callH);
			c.lineTo(w - textWidth, callH);
			c.lineTo(0, h);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_RECT)
		{
			c.rect(w - textWidth,0, textWidth, callH);
			c.fillAndStroke();
			c.begin();
			c.moveTo(w - textWidth * 0.5, callH);
			c.lineTo(0, h);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_ROUNDRECT)
		{
			c.roundrect(w - textWidth,0, textWidth, callH, callH * 0.25, callH * 0.25);
			c.fillAndStroke();
			c.begin();
			c.moveTo(w - textWidth * 0.5, callH);
			c.lineTo(0, h);
			c.stroke();
		}

		c.text(w - textWidth * 0.5, callH * 0.5, 0, 0, calloutText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (callDir === mxShapeMockupCallout.prototype.cst.DIR_SE)
	{
		if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_LINE)
		{
			c.begin();
			c.moveTo(w, h);
			c.lineTo(w - textWidth, h);
			c.lineTo(0, 0);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_RECT)
		{
			c.rect(w - textWidth, h - callH, textWidth, callH);
			c.fillAndStroke();
			c.begin();
			c.moveTo(w - textWidth * 0.5, h - callH);
			c.lineTo(0, 0);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_ROUNDRECT)
		{
			c.roundrect(w - textWidth,h - callH, textWidth, callH, callH * 0.25, callH * 0.25);
			c.fillAndStroke();
			c.begin();
			c.moveTo(w - textWidth * 0.5, h - callH);
			c.lineTo(0, 0);
			c.stroke();
		}

		c.text(w - textWidth * 0.5, h - callH * 0.5, 0, 0, calloutText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (callDir === mxShapeMockupCallout.prototype.cst.DIR_SW)
	{
		if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_LINE)
		{
			c.begin();
			c.moveTo(0, h);
			c.lineTo(textWidth, h);
			c.lineTo(w, 0);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_RECT)
		{
			c.rect(0, h - callH, textWidth, callH);
			c.fillAndStroke();
			c.begin();
			c.moveTo(textWidth * 0.5, h - callH);
			c.lineTo(w, 0);
			c.stroke();
		}
		else if (callStyle === mxShapeMockupCallout.prototype.cst.STYLE_ROUNDRECT)
		{
			c.roundrect(0, h - callH, textWidth, callH, callH * 0.25, callH * 0.25);
			c.fillAndStroke();
			c.begin();
			c.moveTo(textWidth * 0.5, h - callH);
			c.lineTo(w, 0);
			c.stroke();
		}

		c.text(textWidth * 0.5, h - callH * 0.5, 0, 0, calloutText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}

};

mxCellRenderer.registerShape(mxShapeMockupCallout.prototype.cst.SHAPE_CALLOUT, mxShapeMockupCallout);

//**********************************************************************************************************************************************************
//Sticky Note
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupStickyNote(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupStickyNote, mxShape);

mxShapeMockupStickyNote.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_STICKY_NOTE : 'mxgraph.mockup.text.stickyNote'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupStickyNote.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupStickyNote.prototype.background = function(c, w, h)
{
	c.setFillColor('#ffffcc');
	c.begin();
	c.moveTo(w * 0.03, h * 0.07);
	c.lineTo(w * 0.89, h * 0.06);
	c.arcTo(2.81 * w, 2.92 * h, 1, 0, 0, w * 0.99, h * 0.98);
	c.lineTo(w * 0.09, h * 0.99);
	c.arcTo(2.81 * w, 2.92 * h, 1, 0, 1, w * 0.03, h * 0.07);
	c.close();
	c.fill();
};

mxShapeMockupStickyNote.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupStickyNote.prototype.cst.MAIN_TEXT, 'Note line 1,Note line 2,Note line 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupStickyNote.prototype.cst.TEXT_COLOR, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupStickyNote.prototype.cst.TEXT_SIZE, '17').toString();

	c.setFillColor('#ff3300');
	c.begin();
	c.moveTo(w * 0.28 , 0);
	c.lineTo(w * 0.59, 0);
	c.lineTo(w * 0.6, h * 0.12);
	c.lineTo(w * 0.28, h * 0.13);
	c.close();
	c.fill();

	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	var lineNum = mainText.length;
	var textH = lineNum * fontSize * 1.5;

	for (var i = 0; i < mainText.length; i++)
	{
		c.text(w / 2, (h - textH) / 2 + i * fontSize * 1.5 + fontSize * 0.75, 0, 0, mainText[i], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupStickyNote.prototype.cst.SHAPE_STICKY_NOTE, mxShapeMockupStickyNote);

//**********************************************************************************************************************************************************
//Bulleted List
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupBulletedList(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupBulletedList, mxShape);

mxShapeMockupBulletedList.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		BULLET_STYLE : 'bulletStyle',
		STYLE_HYPHEN : 'hyphen',
		STYLE_NUM : 'number',
		STYLE_DOT : 'dot',
		SHAPE_BULLETED_LIST : 'mxgraph.mockup.text.bulletedList'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupBulletedList.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupBulletedList.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupBulletedList.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupBulletedList.prototype.cst.MAIN_TEXT, 'Note line 1,Note line 2,Note line 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupBulletedList.prototype.cst.TEXT_COLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupBulletedList.prototype.cst.TEXT_SIZE, '17');
	var bulletStyle = mxUtils.getValue(this.style, mxShapeMockupBulletedList.prototype.cst.BULLET_STYLE, 'none');

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	var bullet = '';

	for (var i = 0; i < mainText.length; i++)
	{
		var currText = '';

		if (bulletStyle === mxShapeMockupBulletedList.prototype.cst.STYLE_NUM)
		{
			currText = (i + 1) + ') ' + mainText[i]; 
		}
		else if (bulletStyle === mxShapeMockupBulletedList.prototype.cst.STYLE_HYPHEN)
		{
			currText = '- ' + mainText[i]; 
		}
		else if(bulletStyle === mxShapeMockupBulletedList.prototype.cst.STYLE_DOT)
		{
			currText = String.fromCharCode(8226) + ' ' + mainText[i]; 
		}
		else
		{
			currText = '  ' + mainText[i]; 
		}

		c.text(10, i * fontSize * 1.5 + fontSize * 0.75, 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupBulletedList.prototype.cst.SHAPE_BULLETED_LIST, mxShapeMockupBulletedList);

//**********************************************************************************************************************************************************
//Text Box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupTextBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupTextBox, mxShape);

mxShapeMockupTextBox.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_TEXT_BOX : 'mxgraph.mockup.text.textBox'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupTextBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupTextBox.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupTextBox.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupTextBox.prototype.cst.MAIN_TEXT, 'Note line 1').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupTextBox.prototype.cst.TEXT_COLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupTextBox.prototype.cst.TEXT_SIZE, '17');

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	for (var i = 0; i < mainText.length; i++)
	{
		c.text(5, i * fontSize * 1.5 + fontSize * 0.75, 0, 0, mainText[i], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupTextBox.prototype.cst.SHAPE_TEXT_BOX, mxShapeMockupTextBox);

//**********************************************************************************************************************************************************
//Captcha
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupCaptcha(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCaptcha, mxShape);

mxShapeMockupCaptcha.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_CAPTCHA : 'mxgraph.mockup.text.captcha'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupCaptcha.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupCaptcha.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupCaptcha.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupCaptcha.prototype.cst.MAIN_TEXT, 'Note line 1');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupCaptcha.prototype.cst.TEXT_COLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupCaptcha.prototype.cst.TEXT_SIZE, '25');

	c.setFillColor('#88aaff');
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.35, 0);
	c.lineTo(w * 0.55, h * 0.85);
	c.lineTo(w * 0.4, h * 0.75);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(w * 0.7, h * 0.1);
	c.lineTo(w * 0.95, h * 0.23);
	c.lineTo(w, h * 0.4);
	c.lineTo(w, h * 0.9);
	c.lineTo(w, h);
	c.lineTo(w * 0.8, h);
	c.close();
	c.fill();

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	c.text(w * 0.5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.rect(0, 0, w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupCaptcha.prototype.cst.SHAPE_CAPTCHA, mxShapeMockupCaptcha);

//**********************************************************************************************************************************************************
//Alphanumeric
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupAlphanumeric(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupAlphanumeric, mxShape);

mxShapeMockupAlphanumeric.prototype.cst = {
		MAIN_TEXT : 'linkText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SHAPE_ALPHANUMERIC : 'mxgraph.mockup.text.alphanumeric'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupAlphanumeric.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupAlphanumeric.prototype.cst.MAIN_TEXT, '0-9 A B C D E F G H I J K L M N O P Q R S T U V X Y Z');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupAlphanumeric.prototype.cst.TEXT_SIZE, '17');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupAlphanumeric.prototype.cst.TEXT_COLOR, '#0000ff');

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

mxCellRenderer.registerShape(mxShapeMockupAlphanumeric.prototype.cst.SHAPE_ALPHANUMERIC, mxShapeMockupAlphanumeric);

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupTextRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupTextRRect, mxShape);

mxShapeMockupTextRRect.prototype.cst = {
		RRECT : 'mxgraph.mockup.text.rrect',
		R_SIZE : 'rSize'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupTextRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupTextRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupTextRRect.prototype.cst.RRECT, mxShapeMockupTextRRect);

