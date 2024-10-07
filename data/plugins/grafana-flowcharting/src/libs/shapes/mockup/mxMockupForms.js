/**
 * $Id: mxMockupForms.js,v 1.11 2013/05/24 05:21:33 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Checkbox Group (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupCheckboxGroup(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCheckboxGroup, mxShape);

mxShapeMockupCheckboxGroup.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SELECTED : '+',				// must be 1 char
		SHAPE_CHECKBOX_GROUP : 'mxgraph.mockup.forms.checkboxGroup'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupCheckboxGroup.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var fontColor = mxUtils.getValue(this.style, mxShapeMockupCheckboxGroup.prototype.cst.TEXT_COLOR, '#666666,#008cff').toString().split(',');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupCheckboxGroup.prototype.cst.TEXT_SIZE, '17').toString();
	var optionText = mxUtils.getValue(this.style, mxShapeMockupCheckboxGroup.prototype.cst.MAIN_TEXT, 'Option 1').toString().split(',');
	var optionNum = optionText.length;
	var buttonSize = 15;
	var lineH = Math.max(fontSize * 1.5, buttonSize);
	var maxTextWidth = 0;
	var selected = -1;
	var labelOffset = 2.5;
	var minH = optionNum * lineH;
	var trueH = Math.max(h, minH);

	//get min width and selected option 
	for (var i = 0; i < optionNum; i++)
	{
		var currText = optionText[i];

		if(currText.charAt(0) === mxShapeMockupCheckboxGroup.prototype.cst.SELECTED)
		{
			currText = optionText[i].substring(1);
			selected = i;
		}

		var currWidth = mxUtils.getSizeForString(currText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currWidth > maxTextWidth)
		{
			maxTextWidth = currWidth;
		}
	}

	var minW = 2 * labelOffset + maxTextWidth + 2 * buttonSize;
	var trueW = Math.max(w, minW);

	//draw the background
	c.rect(0, 0, trueW, trueH);
	c.fillAndStroke();
	c.setShadow(false);

	c.setFontSize(fontSize);

	for (var i = 0; i < optionNum; i++)
	{
		var currHeight = (i * lineH + lineH * 0.5) * trueH / minH;

		var currText = optionText[i];

		if(currText.charAt(0) === mxShapeMockupCheckboxGroup.prototype.cst.SELECTED)
		{
			c.setFontColor(fontColor[1]);
			currText = optionText[i].substring(1);
			selected = i;
		}
		else
		{
			c.setFontColor(fontColor[0]);
		}

		c.text(buttonSize * 2 + labelOffset, currHeight, 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		var iconX = buttonSize * 0.5;
		var iconY = currHeight - buttonSize * 0.5;
		c.setFillColor('#dddddd');
		c.setStrokeColor('#999999');

		if (selected === i)
		{
			c.setGradient('#aaaaaa', '#666666', iconX, iconY, buttonSize, buttonSize, mxConstants.DIRECTION_SOUTH, 1, 1);
			c.rect(iconX, iconY, buttonSize, buttonSize);
			c.fillAndStroke();
			c.setStrokeColor('#333333');
			c.begin();
			c.moveTo(iconX + buttonSize * 0.25, iconY + buttonSize * 0.5);
			c.lineTo(iconX + buttonSize * 0.5, iconY + buttonSize * 0.75);
			c.lineTo(iconX + buttonSize * 0.75, iconY + buttonSize * 0.25);
			c.stroke();
		}
		else
		{
			c.setGradient('#eeeeee', '#cccccc', iconX, iconY, buttonSize, buttonSize, mxConstants.DIRECTION_SOUTH, 1, 1);
			c.rect(iconX, iconY, buttonSize, buttonSize);
			c.fillAndStroke();
		}

		selected = -1;
	}
};

mxCellRenderer.registerShape(mxShapeMockupCheckboxGroup.prototype.cst.SHAPE_CHECKBOX_GROUP, mxShapeMockupCheckboxGroup);

//**********************************************************************************************************************************************************
//Radio Button Group
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupRadioGroup(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupRadioGroup, mxShape);

mxShapeMockupRadioGroup.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		SELECTED : '+',				// must be 1 char
		SHAPE_RADIO_GROUP : 'mxgraph.mockup.forms.radioGroup'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupRadioGroup.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var fontColor = mxUtils.getValue(this.style, mxShapeMockupRadioGroup.prototype.cst.TEXT_COLOR, '#666666,#008cff').toString().split(',');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupRadioGroup.prototype.cst.TEXT_SIZE, '17').toString();
	var optionText = mxUtils.getValue(this.style, mxShapeMockupRadioGroup.prototype.cst.MAIN_TEXT, 'Option 1').toString().split(',');
	var optionNum = optionText.length;
	var buttonSize = 15;
	var lineH = Math.max(fontSize * 1.5, buttonSize);
	var maxTextWidth = 0;
	var selected = -1;
	var labelOffset = 2.5;
	var minH = optionNum * lineH;
	var trueH = Math.max(h, minH);

	//get min width and selected option 
	for (var i = 0; i < optionNum; i++)
	{
		var currText = optionText[i];

		if(currText.charAt(0) === mxShapeMockupRadioGroup.prototype.cst.SELECTED)
		{
			currText = optionText[i].substring(1);
			selected = i;
		}

		var currWidth = mxUtils.getSizeForString(currText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currWidth > maxTextWidth)
		{
			maxTextWidth = currWidth;
		}
	}

	var minW = 2 * labelOffset + maxTextWidth + 2 * buttonSize;
	var trueW = Math.max(w, minW);

	//draw the background
	c.rect(0, 0, trueW, trueH);
	c.fillAndStroke();
	c.setShadow(false);

	c.setFontSize(fontSize);

	for (var i = 0; i < optionNum; i++)
	{
		var currHeight = (i * lineH + lineH * 0.5) * trueH / minH;

		var currText = optionText[i];

		if(currText.charAt(0) === mxShapeMockupRadioGroup.prototype.cst.SELECTED)
		{
			c.setFontColor(fontColor[1]);
			currText = optionText[i].substring(1);
			selected = i;
		}
		else
		{
			c.setFontColor(fontColor[0]);
		}

		c.text(buttonSize * 2 + labelOffset, currHeight, 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		var iconX = buttonSize * 0.5;
		var iconY = currHeight - buttonSize * 0.5;
		c.setStrokeColor('#999999');

		if (selected === i)
		{
			c.setGradient('#aaaaaa', '#666666', iconX, iconY, buttonSize, buttonSize, mxConstants.DIRECTION_SOUTH, 1, 1);
			c.ellipse(iconX, iconY, buttonSize, buttonSize);
			c.fillAndStroke();
			c.setFillColor('#333333');
			c.setStrokeColor('#333333');
			c.ellipse(iconX + buttonSize * 0.25, iconY + buttonSize * 0.25, buttonSize * 0.5, buttonSize * 0.5);
			c.fillAndStroke();
		}
		else
		{
			c.setGradient('#eeeeee', '#cccccc', iconX, iconY, buttonSize, buttonSize, mxConstants.DIRECTION_SOUTH, 1, 1);
			c.ellipse(iconX, iconY, buttonSize, buttonSize);
			c.fillAndStroke();
		}
	}
};

mxCellRenderer.registerShape(mxShapeMockupRadioGroup.prototype.cst.SHAPE_RADIO_GROUP, mxShapeMockupRadioGroup);

//**********************************************************************************************************************************************************
//Color Picker
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupColorPicker(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupColorPicker, mxShape);

mxShapeMockupColorPicker.prototype.cst = {
		COLOR : 'chosenColor',
		SHAPE_COLOR_PICKER : 'mxgraph.mockup.forms.colorPicker'
};

mxShapeMockupColorPicker.prototype.customProperties = [
	{name: 'chosenColor', dispName: 'Current Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupColorPicker.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var chosenColor = mxUtils.getValue(this.style, mxShapeMockupColorPicker.prototype.cst.COLOR, '#aaddff');

	c.translate(x, y);

	c.setStrokeColor('#999999');
	c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
	c.fillAndStroke();
	c.setShadow(false);

	c.setFillColor(chosenColor);
	c.rect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
	c.fill();

	c.setFillColor('#ffffff');
	c.begin();
	c.moveTo(w * 0.75, h * 0.75);
	c.lineTo(w * 0.75, h);
	c.lineTo(w * 0.95, h);
	c.arcTo(w * 0.05, h * 0.05, 0, 0, 0, w, h * 0.95);
	c.lineTo(w, h * 0.75);
	c.close();
	c.fill();

	c.setFillColor('#999999');
	c.begin();
	c.moveTo(w * 0.77, h * 0.77);
	c.lineTo(w * 0.875, h * 0.98);
	c.lineTo(w * 0.98, h * 0.77);
	c.close();
	c.fill();

	c.roundrect(0, 0, w, h, w * 0.05, h * 0.05);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupColorPicker.prototype.cst.SHAPE_COLOR_PICKER, mxShapeMockupColorPicker);

//**********************************************************************************************************************************************************
//Combo box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupComboBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupComboBox, mxShape);

mxShapeMockupComboBox.prototype.cst = {
		MAIN_TEXT : 'mainText',
		FILL_COLOR2 : 'fillColor2',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_COMBO_BOX : 'mxgraph.mockup.forms.comboBox'
};

mxShapeMockupComboBox.prototype.customProperties = [
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupComboBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
	this.mainText(c, x, y, w, h);
};

mxShapeMockupComboBox.prototype.background = function(c, x, y, w, h)
{
	c.setFillColor('#ffffff');
	c.roundrect(0, 0, w, h, 5, 5);
	c.fillAndStroke();
};

mxShapeMockupComboBox.prototype.foreground = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupComboBox.prototype.cst.FILL_COLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, w - 30, 0, 30, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(w - 30, 0);
	c.lineTo(w - 5, 0);
	c.arcTo(5, 5, 0, 0, 1, w, 5);
	c.lineTo(w, h - 5);
	c.arcTo(5, 5, 0, 0, 1, w - 5, h);
	c.lineTo(w - 30, h);
	c.close();
	c.fillAndStroke();

	c.setFillColor('#ffffff');
	c.begin();
	c.moveTo(w - 22, h * 0.5 - 5);
	c.lineTo(w - 15, h * 0.5 + 5);
	c.lineTo(w - 8, h * 0.5 - 5);
	c.fill();
};

mxShapeMockupComboBox.prototype.mainText = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupComboBox.prototype.cst.MAIN_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupComboBox.prototype.cst.TEXT_COLOR, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupComboBox.prototype.cst.TEXT_SIZE, '17').toString();

	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupComboBox.prototype.cst.SHAPE_COMBO_BOX, mxShapeMockupComboBox);

//**********************************************************************************************************************************************************
//Spinner
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupSpinner(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupSpinner, mxShape);

mxShapeMockupSpinner.prototype.cst = {
		LAYOUT : 'spinLayout',
		SPINNER_STYLE : 'spinStyle',
		ADJ_STYLE : 'adjStyle',
		LAYOUT_RIGHT : 'right',
		LAYOUT_LEFT : 'left',
		LAYOUT_TOP : 'top',
		LAYOUT_BOTTOM : 'bottom',
		LAYOUT_VERTICAL : 'vertical',
		LAYOUT_HORIZONTAL : 'horizontal',
		SPINNER_MERGED : 'merged',
		SPINNER_NORMAL : 'normal',
		ADJ_TRIANGLE : 'triangle',
		ADJ_PLUSMINUS : 'plusMinus',
		ADJ_ARROW : 'arrow',

		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_SPINNER : 'mxgraph.mockup.forms.spinner'
};

mxShapeMockupSpinner.prototype.customProperties = [
	{name: 'spinLayout', dispName: 'Layout', type: 'enum', 
		enumList: [{val: 'right', dispName: 'Right'}, {val: 'left', dispName: 'Left'}, {val: 'top', dispName: 'Top'}, {val: 'bottom', dispName: 'Bottom'}, {val: 'vertical', dispName: 'Vertical'}, {val: 'horizontal', dispName: 'Horizontal'}]
	},
	{name: 'spinStyle', dispName: 'Spinner Style', type: 'enum', 
		enumList: [{val: 'merged', dispName: 'Merged'}, {val: 'normal', dispName: 'Normal'}]
	},
	{name: 'adjStyle', dispName: 'Button Style', type: 'enum', 
		enumList: [{val: 'triangle', dispName: 'Triangle'}, {val: 'plusMinus', dispName: '+/-'}, {val: 'arrow', dispName: 'Arrow'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupSpinner.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var spinnerLayout = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.LAYOUT, mxShapeMockupSpinner.prototype.cst.LAYOUT_RIGHT);
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h, spinnerLayout);
	this.mainText(c, w, h, spinnerLayout);
};

mxShapeMockupSpinner.prototype.background = function(c, w, h)
{
	c.setFillColor('#ffffff');
	c.roundrect(0, 0, w, h, 10, 10);
	c.fillAndStroke();
};

mxShapeMockupSpinner.prototype.foreground = function(c, w, h, spinnerLayout)
{

	var spinnerStyle = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.SPINNER_STYLE, mxShapeMockupSpinner.prototype.cst.SPINNER_NORMAL);
	var adjStyle = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.ADJ_STYLE, mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE);
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');

	c.setFillColor(fillColor);

	if (spinnerStyle === mxShapeMockupSpinner.prototype.cst.SPINNER_NORMAL)
	{
		if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_RIGHT)
		{
			c.begin();
			c.moveTo(w - 20, 0);
			c.lineTo(w - 20, h);
			c.moveTo(w - 20, h * 0.5);
			c.lineTo(w, h * 0.5);
			c.stroke();
		}
		else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_LEFT)
		{
			c.begin();
			c.moveTo(20, 0);
			c.lineTo(20, h);
			c.moveTo(20, h * 0.5);
			c.lineTo(0, h * 0.5);
			c.stroke();
		}
		else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_TOP)
		{
			c.begin();
			c.moveTo(0, 15);
			c.lineTo(w, 15);
			c.moveTo(w * 0.5, 15);
			c.lineTo(w * 0.5, 0);
			c.stroke();
		}
		else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_BOTTOM)
		{
			c.begin();
			c.moveTo(0, h - 15);
			c.lineTo(w, h - 15);
			c.moveTo(w * 0.5, h - 15);
			c.lineTo(w * 0.5, h);
			c.stroke();
		}
		else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_VERTICAL)
		{
			c.begin();
			c.moveTo(0, 15);
			c.lineTo(w, 15);
			c.moveTo(0, h - 15);
			c.lineTo(w, h - 15);
			c.stroke();
		}
		else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_HORIZONTAL)
		{
			c.begin();
			c.moveTo(20, 0);
			c.lineTo(20, h);
			c.moveTo(w - 20, 0);
			c.lineTo(w - 20, h);
			c.stroke();
		}
	}

	c.setStrokeColor(fillColor);

	if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_RIGHT)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.25 + 4.5);
			c.lineTo(w - 10, h * 0.25 - 2.5);
			c.lineTo(w - 6, h * 0.25 + 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w - 10, h * 0.25 - 4);
			c.lineTo(w - 10, h * 0.25 + 4);
			c.moveTo(w - 14, h * 0.25);
			c.lineTo(w - 6, h * 0.25);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.25 + 1.5);
			c.lineTo(w - 10, h * 0.25 - 2.5);
			c.lineTo(w - 6, h * 0.25 + 1.5);
			c.close();
			c.moveTo(w - 10, h * 0.25 + 4.5);
			c.lineTo(w - 10, h * 0.25 - 2.5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_LEFT)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(14, h * 0.25 + 4.5);
			c.lineTo(10, h * 0.25 - 2.5);
			c.lineTo(6, h * 0.25 + 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(10, h * 0.25 - 4);
			c.lineTo(10, h * 0.25 + 4);
			c.moveTo(14, h * 0.25);
			c.lineTo(6, h * 0.25);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(14, h * 0.25 + 1.5);
			c.lineTo(10, h * 0.25 - 2.5);
			c.lineTo(6, h * 0.25 + 1.5);
			c.close();
			c.moveTo(10, h * 0.25 + 4.5);
			c.lineTo(10, h * 0.25 - 2.5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_TOP)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.75 + 4, 12);
			c.lineTo(w * 0.75, 5);
			c.lineTo(w * 0.75 - 4, 12);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.75, 3.5);
			c.lineTo(w * 0.75, 11.5);
			c.moveTo(w * 0.75 + 4, 7.5);
			c.lineTo(w * 0.75 - 4, 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.75 + 4, 9);
			c.lineTo(w * 0.75, 5);
			c.lineTo(w * 0.75 - 4, 9);
			c.close();
			c.moveTo(w * 0.75, 12);
			c.lineTo(w * 0.75, 5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_BOTTOM)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.75 + 4, h - 5);
			c.lineTo(w * 0.75, h - 12);
			c.lineTo(w * 0.75 - 4, h - 5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.75, h - 3.5);
			c.lineTo(w * 0.75, h - 11.5);
			c.moveTo(w * 0.75 + 4, h - 7.5);
			c.lineTo(w * 0.75 - 4, h - 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.75 + 4, h - 6);
			c.lineTo(w * 0.75, h - 10);
			c.lineTo(w * 0.75 - 4, h - 6);
			c.close();
			c.moveTo(w * 0.75, h - 3);
			c.lineTo(w * 0.75, h - 10);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_VERTICAL)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.5 + 4, 12);
			c.lineTo(w * 0.5, 5);
			c.lineTo(w * 0.5 - 4, 12);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.5, 3.5);
			c.lineTo(w * 0.5, 11.5);
			c.moveTo(w * 0.5 + 4, 7.5);
			c.lineTo(w * 0.5 - 4, 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.5 + 4, 9);
			c.lineTo(w * 0.5, 5);
			c.lineTo(w * 0.5 - 4, 9);
			c.close();
			c.moveTo(w * 0.5, 12);
			c.lineTo(w * 0.5, 5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_HORIZONTAL)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w - 6, h * 0.5 + 4.5);
			c.lineTo(w - 10, h * 0.5 - 2.5);
			c.lineTo(w - 14, h * 0.5 + 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w - 10, h * 0.5 - 4);
			c.lineTo(w - 10, h * 0.5 + 4);
			c.moveTo(w - 14, h * 0.5);
			c.lineTo(w - 6, h * 0.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.5 + 1.5);
			c.lineTo(w - 10, h * 0.5 - 2.5);
			c.lineTo(w - 6, h * 0.5 + 1.5);
			c.close();
			c.moveTo(w - 10, h * 0.5 + 4.5);
			c.lineTo(w - 10, h * 0.5 - 2.5);
			c.fillAndStroke();
		}
	}

	if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_RIGHT)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.75 - 4.5);
			c.lineTo(w - 10, h * 0.75 + 2.5);
			c.lineTo(w - 6, h * 0.75 - 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.75);
			c.lineTo(w - 6, h * 0.75);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w - 14, h * 0.75 - 1.5);
			c.lineTo(w - 10, h * 0.75 + 2.5);
			c.lineTo(w - 6, h * 0.75 - 1.5);
			c.close();
			c.moveTo(w - 10, h * 0.75 - 4.5);
			c.lineTo(w - 10, h * 0.75 + 2.5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_LEFT)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(14, h * 0.75 - 4.5);
			c.lineTo(10, h * 0.75 + 2.5);
			c.lineTo(6, h * 0.75 - 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(14, h * 0.75);
			c.lineTo(6, h * 0.75);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(14, h * 0.75 - 1.5);
			c.lineTo(10, h * 0.75 + 2.5);
			c.lineTo(6, h * 0.75 - 1.5);
			c.close();
			c.moveTo(10, h * 0.75 - 4.5);
			c.lineTo(10, h * 0.75 + 2.5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_TOP)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, 5);
			c.lineTo(w * 0.25, 12);
			c.lineTo(w * 0.25 - 4, 5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, 7.5);
			c.lineTo(w * 0.25 - 4, 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, 6);
			c.lineTo(w * 0.25, 10);
			c.lineTo(w * 0.25 - 4, 6);
			c.close();
			c.moveTo(w * 0.25, 3);
			c.lineTo(w * 0.25, 10);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_BOTTOM)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, h - 12);
			c.lineTo(w * 0.25, h - 5);
			c.lineTo(w * 0.25 - 4, h - 12);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, h - 7.5);
			c.lineTo(w * 0.25 - 4, h - 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.25 + 4, h - 9);
			c.lineTo(w * 0.25, h - 5);
			c.lineTo(w * 0.25 - 4, h - 9);
			c.close();
			c.moveTo(w * 0.25, h - 12);
			c.lineTo(w * 0.25, h - 5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_VERTICAL)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(w * 0.5 + 4, h - 12);
			c.lineTo(w * 0.5, h - 5);
			c.lineTo(w * 0.5 - 4, h - 12);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(w * 0.5 + 4, h - 7.5);
			c.lineTo(w * 0.5 - 4, h - 7.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(w * 0.5 + 4, h - 9);
			c.lineTo(w * 0.5, h - 5);
			c.lineTo(w * 0.5 - 4, h - 9);
			c.close();
			c.moveTo(w * 0.5, h - 12);
			c.lineTo(w * 0.5, h - 5);
			c.fillAndStroke();
		}
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_HORIZONTAL)
	{
		if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_TRIANGLE)
		{
			c.begin();
			c.moveTo(6, h * 0.5 - 4.5);
			c.lineTo(10, h * 0.5 + 2.5);
			c.lineTo(14, h * 0.5 - 4.5);
			c.close();
			c.fillAndStroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_PLUSMINUS)
		{
			c.begin();
			c.moveTo(14, h * 0.5);
			c.lineTo(6, h * 0.5);
			c.stroke();
		}
		else if(adjStyle === mxShapeMockupSpinner.prototype.cst.ADJ_ARROW)
		{
			c.begin();
			c.moveTo(14, h * 0.5 - 1.5);
			c.lineTo(10, h * 0.5 + 2.5);
			c.lineTo(6, h * 0.5 - 1.5);
			c.close();
			c.moveTo(10, h * 0.5 - 4.5);
			c.lineTo(10, h * 0.5 + 2.5);
			c.fillAndStroke();
		}
	}
};

mxShapeMockupSpinner.prototype.mainText = function(c, w, h, spinnerLayout)
{
	var spinnerText = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.MAIN_TEXT, '100').toString();
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.TEXT_SIZE, '17');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupSpinner.prototype.cst.TEXT_COLOR, '#666666');
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_RIGHT)
	{
		c.text((w - 20) * 0.5, h * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_LEFT)
	{
		c.text((w + 20) * 0.5, h * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_TOP)
	{
		c.text(w * 0.5, (h + 15) * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_BOTTOM)
	{
		c.text(w * 0.5, (h - 15) * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_VERTICAL)
	{
		c.text(w * 0.5, h * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else if (spinnerLayout === mxShapeMockupSpinner.prototype.cst.LAYOUT_HORIZONTAL)
	{
		c.text(w * 0.5, h * 0.5, 0, 0, spinnerText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupSpinner.prototype.cst.SHAPE_SPINNER, mxShapeMockupSpinner);

//**********************************************************************************************************************************************************
//Menu Bar (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupMenuBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupMenuBar, mxShape);

mxShapeMockupMenuBar.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SHAPE_MENU_BAR : 'mxgraph.mockup.forms.menuBar',
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
mxShapeMockupMenuBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.MAIN_TEXT, '+Menu 1, Menu 2, Menu 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.TEXT_COLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.TEXT_COLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.TEXT_SIZE, '17').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.STROKE_COLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxShapeMockupMenuBar.prototype.cst.FILL_COLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var selectedButton = -1;
	var rSize = 10; //rounding size
	var labelOffset = 5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxShapeMockupMenuBar.prototype.cst.SELECTED)
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

mxShapeMockupMenuBar.prototype.background = function(c, w, h, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton)
{
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

	//draw the selected menu
	if (selectedButton !== -1)
	{
		var buttonLeft = 0;
		c.setFillColor(selectedFillColor);

		for (var i = 0; i < selectedButton; i++)
		{
			buttonLeft += buttonWidths[i] + 2 * labelOffset;
		}

		buttonLeft = buttonLeft * w / minW;
		var buttonRight = (buttonWidths[selectedButton] + 2 * labelOffset) * w / minW;
		buttonRight += buttonLeft;

		c.rect(buttonLeft, 0, buttonRight - buttonLeft, h);
		c.fill();
	}

	//draw the frame again, for a nicer effect
	c.setStrokeColor(frameColor);
	c.setFillColor(bgColor);
	c.rect(0, 0, w, h);
	c.stroke();
};

mxShapeMockupMenuBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxShapeMockupMenuBar.prototype.cst.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupMenuBar.prototype.cst.SHAPE_MENU_BAR, mxShapeMockupMenuBar);

//**********************************************************************************************************************************************************
//Horizontal Slider
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupHorSlider(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupHorSlider, mxShape);

mxShapeMockupHorSlider.prototype.cst = {
		STYLE : 'sliderStyle',
		SLIDER_BASIC : 'basic',
		SLIDER_FANCY : 'fancy',
		SLIDER_POS : 'sliderPos',
		HANDLE_TRIANGLE : 'triangle',
		HANDLE_CIRCLE : 'circle',
		HANDLE_HANDLE : 'handle',
		HANDLE_STYLE : 'handleStyle',
		FILL_COLOR2 : 'fillColor2',
		SHAPE_HOR_SLIDER : 'mxgraph.mockup.forms.horSlider'
};

mxShapeMockupHorSlider.prototype.customProperties = [
	{name: 'sliderStyle', dispName: 'Slider Style', type: 'enum', 
		enumList: [{val: 'basic', dispName: 'Basic'}, {val: 'fancy', dispName: 'Fancy'}]
	},
	{name: 'handleStyle', dispName: 'Handle Style', type: 'enum', 
		enumList: [{val: 'triangle', dispName: 'Triangle'}, {val: 'circle', dispName: 'Circle'}, {val: 'handle', dispName: 'Handle'}]
	},
	{name: 'sliderPos', dispName: 'Handle Position', type: 'float'},
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupHorSlider.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var sliderStyle = mxUtils.getValue(this.style, mxShapeMockupHorSlider.prototype.cst.STYLE, mxShapeMockupHorSlider.prototype.cst.SLIDER_BASIC);
	var rSize = 5;

	c.translate(x, y);
	this.background(c, w, h, rSize, sliderStyle);
	c.setShadow(false);
	this.foreground(c, w, h, rSize, sliderStyle);
	this.sliderPos = 20;
};

mxShapeMockupHorSlider.prototype.background = function(c, w, h, rSize, sliderStyle)
{

	if (sliderStyle === mxShapeMockupHorSlider.prototype.cst.SLIDER_BASIC)
	{
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(w, h * 0.5);
		c.stroke();
	}
	else if (sliderStyle === mxShapeMockupHorSlider.prototype.cst.SLIDER_FANCY)
	{
		c.roundrect(0, h * 0.5 - rSize, w, 2 * rSize, rSize, rSize);
		c.fillAndStroke();
	}
};

mxShapeMockupHorSlider.prototype.foreground = function(c, w, h, rSize, sliderStyle)
{
	var sliderPos = mxUtils.getValue(this.style, mxShapeMockupHorSlider.prototype.cst.SLIDER_POS, '20');
	var handleStyle = mxUtils.getValue(this.style, mxShapeMockupHorSlider.prototype.cst.HANDLE_STYLE, mxShapeMockupHorSlider.prototype.cst.HANDLE_CIRCLE);
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupHorSlider.prototype.cst.FILL_COLOR2, '#ddeeff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
	sliderPos = Math.min(100, sliderPos);
	sliderPos = Math.max(0, sliderPos);

	if (sliderStyle === mxShapeMockupHorSlider.prototype.cst.SLIDER_BASIC)
	{
		c.setStrokeColor(fillColor2);
		var barCenterPos = w * sliderPos / 100;
		c.begin();
		c.moveTo(0, h * 0.5);
		c.lineTo(barCenterPos, h * 0.5);
		c.stroke();
		c.setStrokeColor(strokeColor);
	}
	else if (sliderStyle === mxShapeMockupHorSlider.prototype.cst.SLIDER_FANCY)
	{
		var barCenterPos = 10 + (w - 10) * sliderPos / 100;
		c.setFillColor(fillColor2);
		c.roundrect(0, h * 0.5 - rSize, barCenterPos, 2 * rSize, rSize, rSize);
		c.fillAndStroke();
		c.setFillColor(fillColor);
	}

	var handleCenterPos = 5 + (w - 10) * sliderPos / 100;

	if (handleStyle === mxShapeMockupHorSlider.prototype.cst.HANDLE_CIRCLE)
	{
		c.ellipse(handleCenterPos - 10, h * 0.5 - 10, 20, 20);
		c.fillAndStroke();
	}
	else if (handleStyle === mxShapeMockupHorSlider.prototype.cst.HANDLE_TRIANGLE)
	{
		c.begin();
		c.moveTo(handleCenterPos - 10, h * 0.5 + 10);
		c.lineTo(handleCenterPos, h * 0.5 - 10);
		c.lineTo(handleCenterPos + 10, h * 0.5 + 10);
		c.close();
		c.fillAndStroke();
	}
	else if (handleStyle === mxShapeMockupHorSlider.prototype.cst.HANDLE_HANDLE)
	{
		c.begin();
		c.moveTo(handleCenterPos - 7, h * 0.5 + 10);
		c.lineTo(handleCenterPos - 7, h * 0.5);
		c.lineTo(handleCenterPos, h * 0.5 - 10);
		c.lineTo(handleCenterPos + 7, h * 0.5);
		c.lineTo(handleCenterPos + 7, h * 0.5 + 10);
		c.close();
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeMockupHorSlider.prototype.cst.SHAPE_HOR_SLIDER, mxShapeMockupHorSlider);

Graph.handleFactory[mxShapeMockupHorSlider.prototype.cst.SHAPE_HOR_SLIDER] = function(state)
{
	var handles = [Graph.createHandle(state, ['sliderPos'], function(bounds)
			{
				var sliderPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'sliderPos', this.sliderPos))));

				return new mxPoint(bounds.x + ((bounds.width - 10) * sliderPos / bounds.width) / 100 * bounds.width + 5, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['sliderPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}

//**********************************************************************************************************************************************************
//List Box (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupListBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupListBox, mxShape);

mxShapeMockupListBox.prototype.cst = {
		MAIN_TEXT : 'mainText',
		SUB_TEXT : 'subText',
		BUTTON_TEXT : 'buttonText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		STROKE_COLOR2 : 'strokeColor2',
		STROKE_COLOR3 : 'strokeColor3',
		SELECTED_COLOR : 'selectedColor',
		SELECTED : '+',			//must be 1 char
		SHAPE_LIST_BOX : 'mxgraph.mockup.forms.listBox'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupListBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupListBox.prototype.cst.TEXT_SIZE, '17').toString();

	var selectedButton = -1;
	var maxShapeWidth = w;
	var subText = mxUtils.getValue(this.style, mxShapeMockupListBox.prototype.cst.SUB_TEXT, 'Sub Text').toString().split(',');

	for (var i = 0; i < subText.length; i++)
	{
		var itemText = subText[i];

		if(itemText.charAt(0) === mxShapeMockupListBox.prototype.cst.SELECTED)
		{
			itemText = subText[i].substring(1);
			selectedButton = i;
		}

		var currWidth = mxUtils.getSizeForString(itemText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currWidth > maxShapeWidth)
		{
			maxShapeWidth = currWidth;
		}
	}



	c.translate(x, y);

	w = Math.min(w, maxShapeWidth);
	h = Math.max(h, 30 + subText.length * fontSize * 1.5);

	this.background(c, w, h, bgColor, frameColor);
	c.setShadow(false);
	this.foreground(c, w, h, frameColor, selectedButton, subText, fontSize);
};

mxShapeMockupListBox.prototype.background = function(c, w, h, bgColor, frameColor)
{
	c.setFillColor(bgColor);
	c.setStrokeColor(frameColor);
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupListBox.prototype.foreground = function(c, w, h, frameColor, selectedButton, subText, fontSize)
{
	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');
	var selectedColor = mxUtils.getValue(this.style, mxShapeMockupListBox.prototype.cst.SELECTED_COLOR, '#ddeeff');

	if(selectedButton !== -1)
	{
		c.setFillColor(selectedColor);
		c.rect(0, 30 + selectedButton * fontSize * 1.5, w, fontSize * 1.5);
		c.fill();
	}

	c.begin();
	c.moveTo(0, 30);
	c.lineTo(w, 30);
	c.stroke();

	//buttons
	var windowTitle = mxUtils.getValue(this.style, mxShapeMockupListBox.prototype.cst.MAIN_TEXT, 'Window Title').toString();
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupListBox.prototype.cst.TEXT_COLOR, '#666666,#008cff').toString().split(',');

	c.setFontColor(fontColor[1]);
	c.setFontSize(fontSize);
	c.text(10, 15, 0, 0, windowTitle, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.setFontColor(fontColor[0]);

	for (var i = 0; i < subText.length; i++)
	{
		var currText = subText[i];

		if(currText.charAt(0) === mxShapeMockupListBox.prototype.cst.SELECTED)
		{
			currText = subText[i].substring(1);
		}

		c.text(10, 30 + fontSize * (i * 1.5 + 0.75), 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}

	c.rect(0, 0, w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupListBox.prototype.cst.SHAPE_LIST_BOX, mxShapeMockupListBox);

//**********************************************************************************************************************************************************
//Password Field
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupPwField(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupPwField, mxShape);

mxShapeMockupPwField.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_PW_FIELD : 'mxgraph.mockup.forms.pwField'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupPwField.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupPwField.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupPwField.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupPwField.prototype.cst.MAIN_TEXT, '******');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupPwField.prototype.cst.TEXT_COLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupPwField.prototype.cst.TEXT_SIZE, '17');

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	c.text(5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupPwField.prototype.cst.SHAPE_PW_FIELD, mxShapeMockupPwField);

//**********************************************************************************************************************************************************
//Splitter
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupSplitter(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupSplitter, mxShape);

mxShapeMockupSplitter.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		SHAPE_SPLITTER : 'mxgraph.mockup.forms.splitter'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupSplitter.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(w, 35);
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupSplitter.prototype.background = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.5 - 5);
	c.lineTo(w, h * 0.5 - 5);
	c.lineTo(w, h * 0.5 + 5);
	c.lineTo(0, h * 0.5 + 5);
	c.close();
	c.fill();
};

mxShapeMockupSplitter.prototype.foreground = function(c, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');

	c.begin();
	c.moveTo(0, h * 0.5 - 5);
	c.lineTo(w, h * 0.5 - 5);
	c.moveTo(w, h * 0.5 + 5);
	c.lineTo(0, h * 0.5 + 5);
	c.stroke();

	c.setFillColor(strokeColor);
	c.ellipse(w * 0.5 - 17, h * 0.5 - 2, 4, 4);
	c.fill();
	c.ellipse(w * 0.5 - 2, h * 0.5 - 2, 4, 4);
	c.fill();
	c.ellipse(w * 0.5 + 13, h * 0.5 - 2, 4, 4);
	c.fill();
};

mxCellRenderer.registerShape(mxShapeMockupSplitter.prototype.cst.SHAPE_SPLITTER, mxShapeMockupSplitter);

//**********************************************************************************************************************************************************
//Wedge Bar (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupWedgeBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupWedgeBar, mxShape);

mxShapeMockupWedgeBar.prototype.cst = {
		BLOCK : 'block',
		CONE : 'cone',
		HALF_CONE : 'halfCone',
		ROUND : 'round',
		TEXT_SIZE : 'textSize',
		TAB_NAMES : 'tabs',
		TAB_STYLE : 'tabStyle',
		STYLE_FILLCOLOR2 : 'fillColor2',
		TEXT_COLOR : 'textColor',
		SEL_TEXT_COLOR : 'textColor2',
		SHAPE_WEDGE_BAR : 'mxgraph.mockup.forms.wedgeBar'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupWedgeBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TEXT_SIZE, '17').toString();
	var tabNames = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TAB_NAMES, 'Tab 1,+Tab 2,Tab 3').toString().split(',');

	var tabH = fontSize * 1.5;
	var startOffset = 10;
	var tabOffset = 5;
	var labelOffset = 10;
	var tabCount = tabNames.length;
	var minW = 2 * startOffset + (tabCount - 1) * tabOffset + tabCount * 2 * labelOffset;
	var rSize = 5;
	var labelWidths = new Array();
	var selectedTab = -1;

	for (var i = 0; i < tabCount; i++)
	{
		var currLabel = tabNames[i];

		if(currLabel.charAt(0) === '+')
		{
			currLabel = currLabel.substring(1);
			selectedTab = i;
		}

		var currW = mxUtils.getSizeForString(currLabel, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;

		if (currW === 0)
		{
			labelWidths[i] = 42;
		}
		else
		{
			labelWidths[i] = currW;
		}

		minW = minW + labelWidths[i];
	}

	w = Math.max(w, minW);
	h = Math.max(h, tabH + rSize);

	c.translate(x, y);

	c.setShadow(false);
	this.backTabs(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab);
	this.focusTab(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab);
	this.tabText(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab, tabNames);
};

mxShapeMockupWedgeBar.prototype.backTabs = function(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab)
{
	var tabStyle = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TAB_STYLE, mxShapeMockupWedgeBar.prototype.cst.BLOCK);

	var currW = startOffset;
	for (var i=0; i < tabCount; i++)
	{
		var tabW = labelWidths[i] + 2 * labelOffset;

		if (selectedTab !== i)
		{
			if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.BLOCK)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW, 0);
				c.lineTo(currW + tabW, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.CONE)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW + labelOffset * 0.5, 0);
				c.lineTo(currW + tabW - labelOffset * 0.5, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.HALF_CONE)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW + labelOffset * 0.5, 0);
				c.lineTo(currW + tabW, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.ROUND)
			{
				c.begin();
				c.moveTo(currW - rSize, tabH);
				c.arcTo(rSize, rSize, 0, 0, 0, currW, tabH - rSize);
				c.lineTo(currW, rSize);
				c.arcTo(rSize, rSize, 0, 0, 1, currW + rSize, 0);
				c.lineTo(currW + tabW - rSize, 0);
				c.arcTo(rSize, rSize, 0, 0, 1, currW + tabW, rSize);
				c.lineTo(currW + tabW, tabH - rSize);
				c.arcTo(rSize, rSize, 0, 0, 0, currW + tabW + rSize, tabH);
			}

			c.fillAndStroke();
		}

		currW = currW + tabW + tabOffset;
	}
};

mxShapeMockupWedgeBar.prototype.focusTab = function(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab)
{
	var tabStyle = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TAB_STYLE, mxShapeMockupWedgeBar.prototype.cst.BLOCK);
	var selectedFill = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.STYLE_FILLCOLOR2, '#008cff');

	var currW = startOffset;
	c.setStrokeColor(selectedFill);
	c.setFillColor(selectedFill);

	for (var i=0; i <= selectedTab; i++)
	{
		var tabW = labelWidths[i] + 2 * labelOffset;

		if (selectedTab === i)
		{
			if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.BLOCK)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW, 0);
				c.lineTo(currW + tabW, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.CONE)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW + labelOffset * 0.5, 0);
				c.lineTo(currW + tabW - labelOffset * 0.5, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.HALF_CONE)
			{
				c.begin();
				c.moveTo(currW, tabH);
				c.lineTo(currW + labelOffset * 0.5, 0);
				c.lineTo(currW + tabW, 0);
				c.lineTo(currW + tabW, tabH);
			}
			else if (tabStyle === mxShapeMockupWedgeBar.prototype.cst.ROUND)
			{
				c.begin();
				c.moveTo(currW - rSize, tabH);
				c.arcTo(rSize, rSize, 0, 0, 0, currW, tabH - rSize);
				c.lineTo(currW, rSize);
				c.arcTo(rSize, rSize, 0, 0, 1, currW + rSize, 0);
				c.lineTo(currW + tabW - rSize, 0);
				c.arcTo(rSize, rSize, 0, 0, 1, currW + tabW, rSize);
				c.lineTo(currW + tabW, tabH - rSize);
				c.arcTo(rSize, rSize, 0, 0, 0, currW + tabW + rSize, tabH);
			}

			c.fillAndStroke();
		}

		currW = currW + tabW + tabOffset;
	}
};

mxShapeMockupWedgeBar.prototype.tabText = function(c, w, h, rSize, tabH, startOffset, tabOffset, labelOffset, tabCount, labelWidths, selectedTab, tabNames)
{
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TEXT_COLOR, '#666666');
	var selFontColor = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.SEL_TEXT_COLOR, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupWedgeBar.prototype.cst.TEXT_SIZE, '17').toString();

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	var currW = startOffset;

	for (var i=0; i < tabCount; i++)
	{
		var currLabel = tabNames[i];

		if (i === selectedTab)
		{
			c.setFontColor(selFontColor);
		}

		if (currLabel.charAt(0) === '+')
		{
			currLabel = currLabel.substring(1);
		}

		var tabW = labelWidths[i] + 2 * labelOffset;

		c.text(currW + labelOffset, tabH * 0.5, 0, 0, currLabel, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		currW = currW + tabW + tabOffset;

		if (i === selectedTab)
		{
			c.setFontColor(fontColor);
		}
	}

};

mxCellRenderer.registerShape(mxShapeMockupWedgeBar.prototype.cst.SHAPE_WEDGE_BAR, mxShapeMockupWedgeBar);

//**********************************************************************************************************************************************************
//Search Box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupSearchBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupSearchBox, mxShape);

mxShapeMockupSearchBox.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		STROKE_COLOR2 : 'strokeColor2',
		SHAPE_SEARCH_BOX : 'mxgraph.mockup.forms.searchBox'
};

mxShapeMockupSearchBox.prototype.customProperties = [
	{name: 'strokeColor2', dispName: 'Icon Color', type: 'color'},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupSearchBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupSearchBox.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupSearchBox.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupSearchBox.prototype.cst.MAIN_TEXT, 'Search');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupSearchBox.prototype.cst.TEXT_COLOR, '#666666');
	var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupSearchBox.prototype.cst.STROKE_COLOR2, '#008cff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupSearchBox.prototype.cst.TEXT_SIZE, '17');

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	c.text(5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setStrokeColor(strokeColor2);
	c.ellipse(w - 15, h * 0.5 - 8, 10, 10);
	c.stroke();
	c.begin();
	c.moveTo(w - 19, h * 0.5 + 9);
	c.lineTo(w - 13, h * 0.5 + 1);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupSearchBox.prototype.cst.SHAPE_SEARCH_BOX, mxShapeMockupSearchBox);

//**********************************************************************************************************************************************************
//Sign In (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupSignIn(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupSignIn, mxShape);

mxShapeMockupSignIn.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2',
		TEXT_SIZE : 'textSize',
		TEXT_SIZE2 : 'textSize2',
		STROKE_COLOR2 : 'strokeColor2',
		FILL_COLOR2 : 'fillColor2',
		SHAPE_SIGN_IN : 'mxgraph.mockup.forms.signIn'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupSignIn.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupSignIn.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupSignIn.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.MAIN_TEXT, 'Sign In,User Name:,johndoe,Password:,********,Forgot Password?,New User,SIGN IN,SIGN UP').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.TEXT_COLOR, '#666666');
	var fontColor2 = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.TEXT_COLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.TEXT_SIZE, '12');
	var fontSize2 = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.TEXT_SIZE2, '15');
	var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.STROKE_COLOR2, '#ddeeff');
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupSignIn.prototype.cst.FILL_COLOR2, '#66bbff');

	c.setFillColor(fillColor2);
	c.roundrect(w * 0.09, h * 0.52, w * 0.36, h * 0.09, 5, 5);
	c.fill();

	c.roundrect(w * 0.09, h * 0.84, w * 0.36, h * 0.09, 5, 5);
	c.fill();

	c.rect(w * 0.05, h * 0.22, w * 0.75, h * 0.08);
	c.stroke();

	c.rect(w * 0.05, h * 0.4, w * 0.75, h * 0.08);
	c.stroke();


	c.setStrokeColor(strokeColor2);
	c.setStrokeWidth(2);

	c.begin();	
	c.moveTo(w * 0.05, h * 0.12);
	c.lineTo(w * 0.95, h * 0.12);
	c.moveTo(w * 0.05, h * 0.72);
	c.lineTo(w * 0.95, h * 0.72);
	c.stroke();


	c.setFontColor(fontColor);
	c.setFontSize(fontSize);
	c.text(w * 0.05, h * 0.1, 0, 0, mainText[0], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_BOTTOM, 0, null, 0, 0, 0);
	c.text(w * 0.05, h * 0.2, 0, 0, mainText[1], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_BOTTOM, 0, null, 0, 0, 0);
	c.text(w * 0.075, h * 0.26, 0, 0, mainText[2], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.05, h * 0.38, 0, 0, mainText[3], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_BOTTOM, 0, null, 0, 0, 0);
	c.text(w * 0.075, h * 0.44, 0, 0, mainText[4], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.05, h * 0.8, 0, 0, mainText[6], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setStrokeWidth(1);
	c.setFontColor('#9999ff');
	c.setStrokeColor('#9999ff');
	var forgotW = mxUtils.getSizeForString(mainText[5], fontSize, mxConstants.DEFAULT_FONTFAMILY).width;
	c.text(w * 0.05, h * 0.7, 0, 0, mainText[5], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_BOTTOM, 0, null, 0, 0, 0);

	c.begin();
	c.moveTo(w * 0.05, h * 0.7);
	c.lineTo(w * 0.05 + forgotW, h * 0.7);
	c.stroke();

	c.setFontColor(fontColor2);
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.setFontSize(fontSize2);
	c.text(w * 0.27, h * 0.565, 0, 0, mainText[7], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.27, h * 0.885, 0, 0, mainText[8], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupSignIn.prototype.cst.SHAPE_SIGN_IN, mxShapeMockupSignIn);

//**********************************************************************************************************************************************************
//Calendar (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupCalendar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupCalendar, mxShape);

mxShapeMockupCalendar.prototype.cst = {
		SHAPE_CALENDAR : 'mxgraph.mockup.forms.calendar',
		DAYS : 'days',
		SELECTED_DAY : 'selDay',
		PREV_DAYS : 'prevDays',
		FIRST_DAY : 'firstDay',
		START_ON : 'startOn',
		DAY_NAMES : 'dayNames',
		MAIN_TEXT : 'mainText',
		TEXT_SIZE : 'textSize',
		TEXT_COLOR : 'textColor',
		TEXT_COLOR2 : 'textColor2',
		STROKE_COLOR2 : 'strokeColor2',
		FILL_COLOR2 : 'fillColor2'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupCalendar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeMockupCalendar.prototype.background = function(c, w, h)
{
	c.roundrect(0, 0, w, h, w * 0.0312, h * 0.0286);
	c.fillAndStroke();
};

mxShapeMockupCalendar.prototype.foreground = function(c, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#999999');
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor2 = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.STROKE_COLOR2, '#008cff');
	var fillColor2 = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.FILL_COLOR2, '#ddeeff');
	var mainText = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.MAIN_TEXT, '');
	var textSize = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.TEXT_SIZE, '15');
	var textColor = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.TEXT_COLOR, '#999999');
	var textColor2 = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.TEXT_COLOR2, '#ffffff');
	var days = parseInt(mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.DAYS, '30'), 10);
	var prevDays = parseInt(mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.PREV_DAYS, '31'), 10);
	//month starts on Monday
	var firstDay = parseInt(mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.FIRST_DAY, '0'), 10);
	//week starts with Monday
	var startOn = parseInt(mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.START_ON, '6', 10));
	var dayNames = mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.DAY_NAMES, 'Mo,Tu,We,Th,Fr,Sa,Su').toString().split(',');
	var selDay = parseInt(mxUtils.getValue(this.style, mxShapeMockupCalendar.prototype.cst.SELECTED_DAY, '24'), 10);

	fistDay = Math.max(firstDay, 0);
	startOn = Math.max(startOn, 0);
	fistDay = Math.min(firstDay, 6);
	startOn = Math.min(startOn, 6);

	//buttons
	c.roundrect(w * 0.05, h * 0.0457, w * 0.1438, h * 0.1029, w * 0.025, h * 0.0229);
	c.stroke();
	c.roundrect(w * 0.8125, h * 0.0457, w * 0.1438, h * 0.1029, w * 0.025, h * 0.0229);
	c.stroke();

	//button markers
	c.setStrokeWidth(2);
	c.setStrokeColor(strokeColor2);
	c.begin();
	c.moveTo(w * 0.1438, h * 0.0743);
	c.lineTo(w * 0.1, h * 0.0971);
	c.lineTo(w * 0.1438, h * 0.12);
	c.moveTo(w * 0.8625, h * 0.0743);
	c.lineTo(w * 0.9062, h * 0.0971);
	c.lineTo(w * 0.8625, h * 0.12);
	c.stroke();

	c.setFontSize(textSize);
	c.setFontColor(textColor);
	c.text(w * 0.5, h * 0.0971, 0, 0, mainText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	//write day names
	var range = w * 0.875;
	var cellSize = range / 7;

	for (var i = 0; i < 7; i++)
	{
		var currX = w * 0.0625 + cellSize * 0.5 + i * cellSize;
		var j = i + startOn;

		if (j > 6)
		{
			j = j - 7;
		}

		c.text(currX, h * 0.2114, 0, 0, dayNames[j], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}

	c.setStrokeWidth(1);
	//1st day is on first weekday as default
	var x = 0;
	var selX = -1;
	var selY = -1;

	//check if we need to write days from previous month
	if (firstDay !== startOn)
	{
		c.setStrokeColor(strokeColor);
		c.setFillColor(fillColor2);

		var diff = firstDay - startOn;
		if (diff < 0)
		{
			diff = diff + 7;
		}

		for (var i = 0; i < diff; i++)
		{
			var currX = w * 0.0625 + i * cellSize;
			c.rect(currX, h * 0.2686, cellSize, h * 0.1143);
			c.fillAndStroke();
			var tmp = prevDays - diff + i + 1;

			c.text(currX + cellSize * 0.5, h * 0.2686 + cellSize * 0.5, 0, 0, tmp.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}

		x = diff;
	}

	//now we need to write the actual month days...
	c.setFillColor(fillColor);
	c.setStrokeColor(strokeColor);
	//week begins in first row
	var y = 0;

	for (var i = 0; i < days; i++)
	{
		var d = i + 1; 
		var currX = w * 0.0625 + x * cellSize;
		var currY = h * 0.2686 + y * h * 0.1143;

		if (d === selDay)
		{
			selX = currX;
			selY = currY;
		}
		else
		{
			c.rect(currX, currY, cellSize, h * 0.1143);
			c.fillAndStroke();
			c.text(currX + cellSize * 0.5, currY + cellSize * 0.5, 0, 0, d.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}

		if (x < 6)
		{
			x++;
		}
		else
		{
			x = 0;
			y++;
		}
	}

	var i = 1;
	c.setFillColor(fillColor2);

	while (y < 6)
	{
		var currX = w * 0.0625 + x * cellSize;
		var currY = h * 0.2686 + y * h * 0.1143;
		c.rect(currX, currY, cellSize, h * 0.1143);
		c.fillAndStroke();

		c.text(currX + cellSize * 0.5, currY + cellSize * 0.5, 0, 0, i.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		if (x < 6)
		{
			x++;
		}
		else
		{
			x = 0;
			y++;
		}

		i++;
	}

	if (selX >= 0)
	{
		c.setStrokeColor('#ff0000');
		c.setStrokeWidth(2);
		c.setFillColor(strokeColor2);
		c.setFontColor(textColor2);

		c.rect(selX, selY, cellSize, h * 0.1143);
		c.fillAndStroke();
		c.text(selX + cellSize * 0.5, selY + cellSize * 0.5, 0, 0, selDay.toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxShapeMockupCalendar.prototype.cst.SHAPE_CALENDAR, mxShapeMockupCalendar);

//**********************************************************************************************************************************************************
//Email Form
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupEmailForm(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupEmailForm, mxShape);

mxShapeMockupEmailForm.prototype.cst = {
		MAIN_TEXT : 'mainText',
		TEXT_COLOR : 'textColor',
		SHOW_CC : 'showCC',
		SHOW_BCC : 'showBCC',
		TEXT_SIZE : 'textSize',
		SHAPE_EMAIL_FORM : 'mxgraph.mockup.forms.emailForm'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupEmailForm.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontSize = mxUtils.getValue(this.style, mxShapeMockupEmailForm.prototype.cst.TEXT_SIZE, '12');
	var showCC = mxUtils.getValue(this.style, mxShapeMockupEmailForm.prototype.cst.SHOW_CC, 'true');
	var showBCC = mxUtils.getValue(this.style, mxShapeMockupEmailForm.prototype.cst.SHOW_BCC, 'true');
	var tabX = fontSize * 4;

	var optCount = 0;
	
	if (showCC === 'true')
	{
		optCount++;
	}
	
	if (showBCC === 'true')
	{
		optCount++;
	}
	
	w = Math.max(w, fontSize * 5);
	h = Math.max(h, fontSize * 10.5 + optCount * fontSize * 3);
	
	c.translate(x, y);
	this.background(c, w, h, fontSize, tabX, showCC, showBCC);
	c.setShadow(false);
	this.foreground(c, w, h, fontSize, tabX, showCC, showBCC);
};

mxShapeMockupEmailForm.prototype.background = function(c, w, h, fontSize, tabX, showCC, showBCC)
{
	var messX = fontSize * 9;

	if (showCC === 'true')
	{
		messX = messX + fontSize * 3;
		c.rect(tabX, fontSize * 9, w - tabX, fontSize * 1.5);
		c.fillAndStroke();
	}

	if (showBCC === 'true')
	{
		c.rect(tabX, messX, w - tabX, fontSize * 1.5);
		messX = messX + fontSize * 3;
		c.fillAndStroke();
	}

	c.rect(tabX, 0, w - tabX, fontSize * 1.5);
	c.fillAndStroke();
	c.rect(tabX, fontSize * 3, w - tabX, fontSize * 1.5);
	c.fillAndStroke();
	c.rect(tabX, fontSize * 6, w - tabX, fontSize * 1.5);
	c.fillAndStroke();
	c.rect(0, messX, w, h - messX);
	c.fillAndStroke();
};

mxShapeMockupEmailForm.prototype.foreground = function(c, w, h, fontSize, tabX, showCC, showBCC)
{
	var mainText = mxUtils.getValue(this.style, mxShapeMockupEmailForm.prototype.cst.MAIN_TEXT, 'john@jgraph.com,Greeting,fred@jgraph.com,,,Lorem ipsum').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxShapeMockupEmailForm.prototype.cst.TEXT_COLOR, '#666666');

	c.setFontColor(fontColor);
	c.setFontSize(fontSize);

	c.text(tabX - fontSize * 0.5, fontSize * 0.75, 0, 0, 'From', mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(tabX - fontSize * 0.5, fontSize * 3.75, 0, 0, 'Subject', mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(tabX - fontSize * 0.5, fontSize * 6.75, 0, 0, 'To', mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(tabX + fontSize * 0.5, fontSize * 0.75, 0, 0, mainText[0], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(tabX + fontSize * 0.5, fontSize * 3.75, 0, 0, mainText[1], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(tabX + fontSize * 0.5, fontSize * 6.75, 0, 0, mainText[2], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	
	var messX = fontSize * 9;

	if (showCC === 'true')
	{
		messX = messX + fontSize * 3;
		c.text(tabX - fontSize * 0.5, fontSize * 9.75, 0, 0, 'CC', mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		c.text(tabX + fontSize * 0.5, fontSize * 9.75, 0, 0, mainText[3], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}

	if (showBCC === 'true')
	{
		c.text(tabX - fontSize * 0.5, messX + fontSize * 0.75, 0, 0, 'BCC', mxConstants.ALIGN_RIGHT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		c.text(tabX + fontSize * 0.5, messX + fontSize * 0.75, 0, 0, mainText[4], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		messX = messX + fontSize * 3;
	}

	c.text(fontSize * 0.5, messX + fontSize * 0.75, 0, 0, mainText[5], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxShapeMockupEmailForm.prototype.cst.SHAPE_EMAIL_FORM, mxShapeMockupEmailForm);

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupFormsRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupFormsRRect, mxShape);

mxShapeMockupFormsRRect.prototype.cst = {
		RRECT : 'mxgraph.mockup.forms.rrect',
		R_SIZE : 'rSize'
};

mxShapeMockupFormsRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:10},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupFormsRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupFormsRRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupFormsRRect.prototype.cst.RRECT, mxShapeMockupFormsRRect);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupFormsAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeMockupFormsAnchor, mxShape);

mxShapeMockupFormsAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.mockup.forms.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupFormsAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeMockupFormsAnchor.prototype.cst.ANCHOR, mxShapeMockupFormsAnchor);

//**********************************************************************************************************************************************************
//Checkbox
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupFormsCheckbox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupFormsCheckbox, mxShape);

mxShapeMockupFormsCheckbox.prototype.cst = {
		CHECKBOX : 'mxgraph.mockup.forms.checkbox'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupFormsCheckbox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.8, h * 0.2);
	c.lineTo(w * 0.4, h * 0.8);
	c.lineTo(w * 0.25, h * 0.6);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupFormsCheckbox.prototype.cst.CHECKBOX, mxShapeMockupFormsCheckbox);

//**********************************************************************************************************************************************************
//U Rect
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupFormsURect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupFormsURect, mxShape);

mxShapeMockupFormsURect.prototype.cst = {
		U_RECT : 'mxgraph.mockup.forms.uRect'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupFormsURect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeMockupFormsURect.prototype.cst.U_RECT, mxShapeMockupFormsURect);

