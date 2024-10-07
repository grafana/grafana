/**
 * $Id: mxIOS7Ui.js,v 1.6 2013/12/04 16:48:54 mate Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */

var mxIOS7C =
{
		MAIN_TEXT : 'mainText',
		SUB_TEXT : 'subText',
		TEXT_COLOR : 'textColor',
		TEXT_SIZE : 'textSize',
		BAR_POS : 'barPos',
		BUTTON_TEXT : 'buttonText',
		BUTTON_STATE : 'buttonState',
		SELECTED : '+', 		//has to be one character long
		STATE_ON : 'on',
		STATE_OFF : 'off',
		GRID_SIZE : 'gridSize',
		
		SHAPE_IOS7_APP_BAR : 'mxgraph.ios7ui.appBar',
		SHAPE_IOS7_ON_OFF_BUTTON : 'mxgraph.ios7ui.onOffButton',
		SHAPE_IOS7_SLIDER : 'mxgraph.ios7ui.slider',
		SHAPE_IOS7_DOWNLOAD_BAR : 'mxgraph.ios7ui.downloadBar',
		SHAPE_IOS7_ICON : 'mxgraph.ios7ui.icon',
		SHAPE_IOS7_HOR_BUTTON_BAR : 'mxgraph.ios7ui.horButtonBar',
		SHAPE_IOS7_PAGE_CONTROL : 'mxgraph.ios7ui.pageControl',
		SHAPE_IOS7_EXPAND :  'mxgraph.ios7ui.expand',
		SHAPE_IOS7_ICON_GRID : 'mxgraph.ios7ui.iconGrid',
		SHAPE_IOS7_PHONE : 'mxgraph.ios7ui.phone',
		SHAPE_IOS7_SEARCH_BOX : 'mxgraph.ios7ui.searchBox',
		SHAPE_IOS7_URL : 'mxgraph.ios7ui.url',
		SHAPE_IOS7_ACTION_DIALOG : 'mxgraph.ios7ui.actionDialog',
		
		STYLE_FILLCOLOR2 : 'fillColor2',
		STYLE_FILLCOLOR3 : 'fillColor3',
		STYLE_TEXTCOLOR : 'textColor',
		STYLE_TEXTCOLOR2 : 'textColor2',
		STYLE_STROKECOLOR2 : 'strokeColor2',
		STYLE_STROKECOLOR3 : 'strokeColor3',
		STYLE_TEXTSIZE : 'textSize'
};

//**********************************************************************************************************************************************************
//iOS7 Application Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeIOS7AppBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7AppBar, mxShape);

mxShapeIOS7AppBar.prototype.customProperties = [
	{name: 'fillColor2', dispName: 'Fill Color 2', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeIOS7AppBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeIOS7AppBar.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeIOS7AppBar.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor(mxUtils.getValue(this.style, mxIOS7C.STYLE_FILLCOLOR2, '#222222'));

	c.ellipse(5, h * 0.5 - 1.5, 3, 3);
	c.fill();
	c.ellipse(9, h * 0.5 - 1.5, 3, 3);
	c.fill();
	c.ellipse(13, h * 0.5 - 1.5, 3, 3);
	c.fill();
	c.ellipse(17, h * 0.5 - 1.5, 3, 3);
	c.fill();
	c.ellipse(21, h * 0.5 - 1.5, 3, 3);
	c.fill();
	
	c.ellipse(54, h * 0.5 + 2, 2, 2);
	c.fillAndStroke();
	
	c.setStrokeWidth(2);
	c.begin();
	c.moveTo(52, h * 0.5 + 1);
	c.arcTo(3.5, 3.5, 0, 0, 1, 58, h * 0.5 + 1);
	c.stroke();
	
	c.begin();
	c.moveTo(50, h * 0.5 - 1);
	c.arcTo(6, 6, 0, 0, 1, 60, h * 0.5 - 1);
	c.stroke();
	
	c.begin();
	c.moveTo(w - 19, h * 0.5 - 2);
	c.lineTo(w - 6, h * 0.5 - 2);
	c.lineTo(w - 6, h * 0.5 + 2);
	c.lineTo(w - 19, h * 0.5 + 2);
	c.close();
	c.fill();

	c.setStrokeWidth(1);
	c.begin();
	c.moveTo(w - 44, h * 0.5  - 2.5);
	c.lineTo(w - 36, h * 0.5  + 2.5);
	c.lineTo(w - 40, h * 0.5 + 5);
	c.lineTo(w - 40, h * 0.5 - 5);
	c.lineTo(w - 36, h * 0.5 - 2.5);
	c.lineTo(w - 44, h * 0.5 + 2.5);
	c.stroke();
	
	c.begin();
	c.moveTo(w - 20, h * 0.5 - 3);
	c.lineTo(w - 5, h * 0.5 - 3);
	c.lineTo(w - 5, h * 0.5 - 1);
	c.lineTo(w - 3.5, h * 0.5 - 1);
	c.lineTo(w - 3.5, h * 0.5 + 1);
	c.lineTo(w - 5, h * 0.5 + 1);
	c.lineTo(w - 5, h * 0.5 + 3);
	c.lineTo(w - 20, h * 0.5 + 3);
	c.close();
	c.stroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_APP_BAR, mxShapeIOS7AppBar);

//**********************************************************************************************************************************************************
//On-Off Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7OnOffButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7OnOffButton, mxShape);

mxShapeIOS7OnOffButton.prototype.customProperties = [
	{name: 'buttonState', dispName: 'Button State', type: 'enum',
		enumList: [{val: 'on', dispName: 'On'},
				   {val: 'off', dispName: 'Off'}]
	},
	{name: 'strokeColor2', dispName: 'Stroke Color 2', type: 'color'},
	{name: 'fillColor2', dispName: 'Fill Color 2', type: 'color'},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7OnOffButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	w = Math.max(w, 2 * h);
	var state = mxUtils.getValue(this.style, mxIOS7C.BUTTON_STATE, mxIOS7C.STATE_ON);
	this.background(c, x, y, w, h, state);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, state);
};

mxShapeIOS7OnOffButton.prototype.background = function(c, x, y, w, h, state)
{
	if (state === mxIOS7C.STATE_ON)
	{
		c.roundrect(0, 0, w, h, h * 0.5, h * 0.5);
		c.fillAndStroke();
	}
	else if (state === mxIOS7C.STATE_OFF)
	{
		c.setStrokeColor(mxUtils.getValue(this.style, mxIOS7C.STYLE_STROKECOLOR2, '#aaaaaa'));
		c.setFillColor(mxUtils.getValue(this.style, mxIOS7C.STYLE_FILLCOLOR2, '#ffffff'));
		c.roundrect(0, 0, w, h, h * 0.5, h * 0.5);
		c.fillAndStroke();
	}

};

mxShapeIOS7OnOffButton.prototype.foreground = function(c, x, y, w, h, state)
{
	c.setFillColor('#ffffff');

	if (state === mxIOS7C.STATE_ON)
	{
		c.ellipse(w - h + 1, 1, h - 2, h - 2);
		c.fill();
	}
	else
	{
		c.ellipse(0, 0, h, h);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_ON_OFF_BUTTON, mxShapeIOS7OnOffButton);

//**********************************************************************************************************************************************************
//Slider
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7Slider(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.barPos = 80;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeIOS7Slider, mxShape);



/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Slider.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeIOS7Slider.prototype.foreground = function(c, w, h)
{
	c.setStrokeWidth(2);
	
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();

	var barPos = mxUtils.getValue(this.style, mxIOS7C.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = 0; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setStrokeColor(mxUtils.getValue(this.style, mxIOS7C.STYLE_STROKECOLOR2, '#a0a0a0'));
	c.ellipse(truePos - 5, h * 0.5 - 5, 10, 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_SLIDER, mxShapeIOS7Slider);

Graph.handleFactory[mxIOS7C.SHAPE_IOS7_SLIDER] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'barPos', this.barPos))));

				return new mxPoint(bounds.x + barPos / 100 * bounds.width, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}

//**********************************************************************************************************************************************************
//Download Bar
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7DownloadBar(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.barPos = 80;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeIOS7DownloadBar, mxShape);

mxShapeIOS7DownloadBar.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, max:1, defVal:30},
	{name: 'strokeColor2', dispName: 'Stroke Color 2', type: 'color'}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7DownloadBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.foreground(c, w, h);
};

mxShapeIOS7DownloadBar.prototype.foreground = function(c, w, h)
{
	var fieldText = mxUtils.getValue(this.style, mxIOS7C.BUTTON_TEXT, '');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.text(w * 0.5, h * 0.2, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var barPos = mxUtils.getValue(this.style, mxIOS7C.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var truePos = w * barPos / 100;

	c.setStrokeWidth(2);
	c.setStrokeColor(mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, ''));
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();

	c.setStrokeColor(mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, ''));
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(truePos, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_DOWNLOAD_BAR, mxShapeIOS7DownloadBar);

Graph.handleFactory[mxIOS7C.SHAPE_IOS7_DOWNLOAD_BAR] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'barPos', this.barPos))));

				return new mxPoint(bounds.x + barPos / 100 * bounds.width, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(1000 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 1000;
			})];

	return handles;
}

//**********************************************************************************************************************************************************
//Icon
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7Icon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7Icon, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Icon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.foreground(c, w, h);
};

mxShapeIOS7Icon.prototype.foreground = function(c, w, h)
{
	c.setGradient('#00D0F0', '#0080F0', w * 0.325, 0, w * 0.675, h * 0.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(0, 0, w, h, w * 0.1, h * 0.1);
	c.fill();
	
	var fieldText = mxUtils.getValue(this.style, mxIOS7C.BUTTON_TEXT, '');
	c.setFontColor('#ffffff');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.setFontSize(8);
	c.text(w * 0.5, h * 0.5, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_ICON, mxShapeIOS7Icon);

//**********************************************************************************************************************************************************
//Horizontal Button Bar
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7horButtonBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7horButtonBar, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7horButtonBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxIOS7C.BUTTON_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTCOLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTCOLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8.5').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_FILLCOLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var selectedButton = -1;
	var rSize = 2.5; //rounding size
	var labelOffset = 2.5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxIOS7C.SELECTED)
		{
			buttonText = textStrings[i].substring(1);
			selectedButton = i;
		}

		buttonWidths[i] = mxUtils.getSizeForString(buttonText, fontSize, mxConstants.DEFAULT_FONTFAMILY).width;
		buttonTotalWidth += buttonWidths[i];
	}

	var trueH = Math.max(h, fontSize * 1.5, 10);
	var minW = 2 * labelOffset * buttonNum + buttonTotalWidth;
	var trueW = Math.max(w, minW);

	c.translate(x, y);
	this.background(c, trueW, trueH, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, bgColor, selectedFillColor, selectedButton);
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

mxShapeIOS7horButtonBar.prototype.background = function(c, w, h, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, bgColor, selectedFillColor, selectedButton)
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
	c.setStrokeColor(frameColor);
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
	c.setStrokeColor(mxConstants.NONE);

	for (var i = 0; i < selectedButton; i++)
	{
		buttonLeft += buttonWidths[i] + 2 * labelOffset;
	}

	buttonLeft = buttonLeft * w / minW;
	var buttonRight = (buttonWidths[selectedButton] + 2 * labelOffset) * w / minW;
	buttonRight += buttonLeft;
	c.setFillColor('#0080F0');

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

mxShapeIOS7horButtonBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxIOS7C.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_HOR_BUTTON_BAR, mxShapeIOS7horButtonBar);

//**********************************************************************************************************************************************************
//Page Control
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7pageControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7pageControl, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7pageControl.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#000000');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

	var rSize = Math.min(h * 0.5, w * 0.05);
	c.setFillColor(strokeColor);
	c.ellipse(0, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w * 0.25 - rSize * 0.5, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w * 0.5 - rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w * 0.75 - rSize * 1.5, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.setFillColor(fillColor);
	c.ellipse(w - 2 * rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_PAGE_CONTROL, mxShapeIOS7pageControl);

//**********************************************************************************************************************************************************
//Icon Grid
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7iconGrid(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7iconGrid, mxShape);

mxShapeIOS7iconGrid.prototype.customProperties = [
	{name: 'gridSize', dispName: 'Grid Size', type: 'String'},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7iconGrid.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var gridSize = mxUtils.getValue(this.style, mxIOS7C.GRID_SIZE, '4,7').toString().split(',');

	var boxSizeX = w / (parseInt(gridSize[0],10) + (gridSize[0]-1) * 0.1);
	var boxSizeY = h / (parseInt(gridSize[1],10) + (gridSize[1]-1) * 0.1);
	
	for (var i = 0; i < gridSize[0]; i++)
	{
		for (var j = 0; j < gridSize[1]; j++)
		{
			c.rect(boxSizeX * 1.1 * i, boxSizeY * 1.1 * j, boxSizeX, boxSizeY);
			c.fill();
		}
	}
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_ICON_GRID, mxShapeIOS7iconGrid);

//**********************************************************************************************************************************************************
//iPhone Vertical
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7phone(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7phone, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7phone.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = 25;

	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeIOS7phone.prototype.foreground = function(c, x, y, w, h, rSize)
{
	c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
	c.stroke();

	c.ellipse(w * 0.4875, h * 0.04125, w * 0.025, h * 0.0125);
	c.stroke();

	c.roundrect(w * 0.375, h * 0.075, w * 0.25, h * 0.01875, w * 0.02, h * 0.01);
	c.stroke();
	c.ellipse(w * 0.4, h * 0.875, w * 0.2, h * 0.1);
	c.stroke();
	c.roundrect(w * 0.4575, h * 0.905, w * 0.085, h * 0.04375, h * 0.00625, h * 0.00625);
	c.stroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_PHONE, mxShapeIOS7phone);

//**********************************************************************************************************************************************************
//Search Box
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7searchBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7searchBox, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7searchBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeIOS7searchBox.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeIOS7searchBox.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxIOS7C.BUTTON_TEXT, 'Search');
	var fontColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTCOLOR, '#666666');
	var strokeColor2 = mxUtils.getValue(this.style, mxIOS7C.STYLE_STROKECOLOR2, '#008cff');
	var fontSize = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTSIZE, '17');
	var rSize = Math.min(w, h) * 0.1;

	c.setFillColor('#ffffff');
	c.roundrect(w * 0.05, h * 0.15, w * 0.5, h * 0.7, rSize, rSize);
	c.fillAndStroke();
	
	c.setFontColor(fontColor);
	c.setFontSize(Math.min(h * 0.7, w * 0.1));

	c.text(5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setStrokeColor(strokeColor2);
	c.ellipse(w * 0.05 + 3, h * 0.5 - 3, 4, 4);
	c.stroke();
	c.begin();
	c.moveTo(w * 0.05 + 8, h * 0.5 + 3.5);
	c.lineTo(w * 0.05 + 6, h * 0.5 + 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_SEARCH_BOX, mxShapeIOS7searchBox);

//**********************************************************************************************************************************************************
//URL
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7URL(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7URL, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7URL.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxShapeIOS7URL.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeIOS7URL.prototype.foreground = function(c, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxIOS7C.BUTTON_TEXT, 'draw.io');
	var fontColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTCOLOR, '#666666');
	var strokeColor2 = mxUtils.getValue(this.style, mxIOS7C.STYLE_STROKECOLOR2, '#008cff');
	var fontSize = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTSIZE, '17');
	var rSize = Math.min(w, h) * 0.1;

	c.setFillColor('#d8d8d8');
	c.roundrect(w * 0.05, h * 0.15, w * 0.9, h * 0.7, rSize, rSize);
	c.fill();
	
	c.setFontColor(fontColor);
	c.setFontSize(Math.min(h * 0.7, w * 0.1));

	c.text(w * 0.5, h * 0.5, 0, 0, mainText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setStrokeColor(strokeColor2);
	c.begin();
	c.moveTo(w * 0.95 - 5, h * 0.5);
	c.arcTo(3, 3, 0, 1, 1, w * 0.95 - 8, h * 0.5 - 3);
	c.stroke();

	c.setFillColor(strokeColor2);
	c.begin();
	c.moveTo(w * 0.95 - 8, h * 0.5 - 4);
	c.lineTo(w * 0.95 - 6, h * 0.5 - 3);
	c.lineTo(w * 0.95 - 8, h * 0.5 - 2);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_URL, mxShapeIOS7URL);

//**********************************************************************************************************************************************************
//Action Dialog
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7Actiondialog(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7Actiondialog, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Actiondialog.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxIOS7C.MAIN_TEXT, 'Main Text');
	var subText = mxUtils.getValue(this.style, mxIOS7C.SUB_TEXT, 'Sub Text');
	var fontColor = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTCOLOR, '#666666');
	var fontSize = mxUtils.getValue(this.style, mxIOS7C.STYLE_TEXTSIZE, '17');
	c.translate(x, y);
	this.background(c, x, y, w, h);
	
	c.setShadow(false);
	
	c.setFillColor('#e0e0e0');
	c.roundrect(w * 0.05, h * 0.1, w * 0.9, h * 0.35, w * 0.025, h * 0.05);
	c.fill();
	c.roundrect(w * 0.05, h * 0.55, w * 0.9, h * 0.35, w * 0.025, h * 0.05);
	c.fill();
	
	c.setFontStyle(mxConstants.FONT_BOLD);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
	this.subText(c, x, y, w, h, subText, fontSize / 1.4, fontColor);
};

mxShapeIOS7Actiondialog.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeIOS7Actiondialog.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5, h * 0.4, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxShapeIOS7Actiondialog.prototype.subText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.text(w * 0.5, h * 0.7, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxIOS7C.SHAPE_IOS7_ACTION_DIALOG, mxShapeIOS7Actiondialog);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7Anchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeIOS7Anchor, mxShape);

mxShapeIOS7Anchor.prototype.cst = {
		ANCHOR : 'mxgraph.ios7ui.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Anchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeIOS7Anchor.prototype.cst.ANCHOR, mxShapeIOS7Anchor);

//**********************************************************************************************************************************************************
//Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7RRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7RRect, mxShape);

mxShapeIOS7RRect.prototype.cst = {
		RRECT : 'mxgraph.ios7ui.rrect',
		R_SIZE : 'rSize'
};

mxShapeIOS7RRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:3}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7RRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIOS7RRect.prototype.cst.R_SIZE, '10'));
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeIOS7RRect.prototype.cst.RRECT, mxShapeIOS7RRect);

//**********************************************************************************************************************************************************
//Left Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7LeftButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7LeftButton, mxShape);

mxShapeIOS7LeftButton.prototype.cst = {
		LEFT_BUTTON : 'mxgraph.ios7ui.leftButton',
		R_SIZE : 'rSize'
};

mxShapeIOS7LeftButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:3}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7LeftButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIOS7LeftButton.prototype.cst.R_SIZE, '10'));

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

mxCellRenderer.registerShape(mxShapeIOS7LeftButton.prototype.cst.LEFT_BUTTON, mxShapeIOS7LeftButton);

//**********************************************************************************************************************************************************
//Right Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7RightButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7RightButton, mxShape);

mxShapeIOS7RightButton.prototype.cst = {
		RIGHT_BUTTON : 'mxgraph.ios7ui.rightButton',
		R_SIZE : 'rSize'
};

mxShapeIOS7RightButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:3}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7RightButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIOS7RightButton.prototype.cst.R_SIZE, '10'));

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

mxCellRenderer.registerShape(mxShapeIOS7RightButton.prototype.cst.RIGHT_BUTTON, mxShapeIOS7RightButton);

//**********************************************************************************************************************************************************
//Top Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7TopButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7TopButton, mxShape);

mxShapeIOS7TopButton.prototype.cst = {
		TOP_BUTTON : 'mxgraph.ios7ui.topButton',
		R_SIZE : 'rSize'
};

mxShapeIOS7TopButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:3}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7TopButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIOS7TopButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(w, h);
	c.lineTo(0, h);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeIOS7TopButton.prototype.cst.TOP_BUTTON, mxShapeIOS7TopButton);

//**********************************************************************************************************************************************************
//Bottom Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7BottomButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7BottomButton, mxShape);

mxShapeIOS7BottomButton.prototype.cst = {
		BOTTOM_BUTTON : 'mxgraph.ios7ui.bottomButton',
		R_SIZE : 'rSize'
};

mxShapeIOS7BottomButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:3},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7BottomButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIOS7BottomButton.prototype.cst.R_SIZE, '10'));

	c.begin();
	c.moveTo(w, 0);
	c.lineTo(0, 0);
	c.lineTo(0, h - rSize);
	c.arcTo(rSize, rSize, 0, 0, 0, rSize, h);
	c.lineTo(w - rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 0, w, h - rSize);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxShapeIOS7BottomButton.prototype.cst.BOTTOM_BUTTON, mxShapeIOS7BottomButton);

//**********************************************************************************************************************************************************
//Horizontal Lines
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7HorLines(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7HorLines, mxShape);

mxShapeIOS7HorLines.prototype.cst = {
		HOR_LINES : 'mxgraph.ios7ui.horLines'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7HorLines.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fill();
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.moveTo(0, h);
	c.lineTo(w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeIOS7HorLines.prototype.cst.HOR_LINES, mxShapeIOS7HorLines);

//**********************************************************************************************************************************************************
//rect with margins
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7MarginRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7MarginRect, mxShape);

mxShapeIOS7MarginRect.prototype.customProperties = [
	{name: 'rx', dispName: 'Hor. Rounding Size', type: 'float', min:0, defVal:3},
	{name: 'ry', dispName: 'Ver. Rounding Size', type: 'float', min:0, defVal:3},
	{name: 'rectMargin', dispName: 'Global Margin', type: 'float', min:0, defVal:5},
	{name: 'rectMarginTop', dispName: 'Top Margin', type: 'float', min:0, defVal:0},
	{name: 'rectMarginLeft', dispName: 'Left Margin', type: 'float', min:0, defVal:0},
	{name: 'rectMarginBottom', dispName: 'Bottom Margin', type: 'float', min:0, defVal:0},
	{name: 'rectMarginRight', dispName: 'Right Margin', type: 'float', min:0, defVal:0}
];

mxShapeIOS7MarginRect.prototype.cst = {
		SHAPE_MARGIN_RECT : 'mxgraph.ios7ui.marginRect',
		MARGIN : 'rectMargin',
		RX : 'rx',
		RY : 'ry',
		MARGIN_TOP : 'rectMarginTop',
		MARGIN_LEFT : 'rectMarginLeft',
		MARGIN_BOTTOM : 'rectMarginBottom',
		MARGIN_RIGHT : 'rectMarginRight'
};
/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7MarginRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeIOS7MarginRect.prototype.background = function(c, x, y, w, h, state)
{
	var margin = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.MARGIN, '0'));
	var marginTop = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.MARGIN_TOP, '0'));
	var marginLeft = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.MARGIN_LEFT, '0'));
	var marginBottom = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.MARGIN_BOTTOM, '0'));
	var marginRight = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.MARGIN_RIGHT, '0'));
	var rx = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.RX, '0'));
	var ry = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7MarginRect.prototype.cst.RY, '0'));

	var x1 = margin + marginLeft;
	var y1 = margin + marginTop;
	var w1 = w - marginRight - x1 - margin;
	var h1 = h - marginBottom - y1 - margin;

	if (w1 >0 && h1 > 0)
	{
		c.begin();
		c.roundrect(x1, y1, w1, h1, rx, ry);
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeIOS7MarginRect.prototype.cst.SHAPE_MARGIN_RECT, mxShapeIOS7MarginRect);

//**********************************************************************************************************************************************************
//Callout
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7Callout(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7Callout, mxShape);

mxShapeIOS7Callout.prototype.cst = {
		SHAPE_CALLOUT : 'mxgraph.ios7ui.callout'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Callout.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeIOS7Callout.prototype.background = function(c, x, y, w, h, state)
{
	var r = 10;
	
	if (w >= 30 && h >= 20)
	{
		c.begin();
		c.moveTo(15, h - r * 0.3);
		c.arcTo(r * 2, r, 0, 0, 1, 0, h);
		c.arcTo(r * 1.5, r * 1.5, 0, 0, 0, 10, h - r * 1);
		c.lineTo(r, r);
		c.arcTo(r, r, 0, 0, 1, r * 2, 0);
		c.lineTo(w - r, 0);
		c.arcTo(r, r, 0, 0, 1, w, r);
		c.lineTo(w, h - r);
		c.arcTo(r, r, 0, 0, 1, w - r, h);
		c.lineTo(r * 2, h);
		c.arcTo(r, r, 0, 0, 1, r * 1.5, h - r * 0.3);
		c.close();
		c.fillAndStroke();
	}
};

mxCellRenderer.registerShape(mxShapeIOS7Callout.prototype.cst.SHAPE_CALLOUT, mxShapeIOS7Callout);

//**********************************************************************************************************************************************************
//Select Bar
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIOS7SelectBar(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.dy = 0.5;
	this.dx = 0.5;
	this.dx2 = 70;
	this.size = 10;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeIOS7SelectBar, mxActor);

mxShapeIOS7SelectBar.prototype.cst = {
		SELECT_BAR : 'mxgraph.ios7ui.selectBar'
};

mxShapeIOS7SelectBar.prototype.customProperties = [
	{name: 'dx', dispName: 'Callout Position', type: 'float', min:0, defVal:120},
	{name: 'dx2', dispName: 'Field Size', type: 'float', min:0, defVal: 75},
	{name: 'size', dispName: 'Rounding size', type: 'float', min:0, defVal:5},
	{name: 'dy', dispName: 'Callout Size', type: 'float', min:0, defVal:5}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7SelectBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var dx = Math.max(0, Math.min(w, parseFloat(mxUtils.getValue(this.style, 'dx', this.dx))));
	var dx2 = Math.max(0, Math.min(w, parseFloat(mxUtils.getValue(this.style, 'dx2', this.dx2))));
	var r = Math.max(0, Math.min(h, parseFloat(mxUtils.getValue(this.style, 'size', this.size))));
	var dy = Math.max(0, Math.min(h, (w - Math.max(20, r) - r) / 2, parseFloat(mxUtils.getValue(this.style, 'dy', this.dy))));

	r = Math.min(h / 2, w / 2, r);
	dx = Math.max(r + dy, dx);
	dx = Math.min(w - r - dy, w - 20 - dy, dx);
	
	c.begin();
	c.moveTo(dx - dy, h);
	c.lineTo(r, h);
	c.arcTo(r, r, 0, 0, 1, 0, h - r);
	c.lineTo(0, r);
	c.arcTo(r, r, 0, 0, 1, r, 0);
	c.lineTo(w - r, 0);
	c.arcTo(r, r, 0, 0, 1, w, r);
	c.lineTo(w, h - r);
	c.arcTo(r, r, 0, 0, 1, w - r, h);
	c.lineTo(dx + dy, h);
	c.lineTo(dx, h + dy);
	c.close();
	c.fillAndStroke();
	
	c.setShadow(false);
	
	c.begin();
	c.moveTo(w - Math.max(20, r), 0);
	c.lineTo(w - Math.max(20, r), h);
	c.stroke();

	var currDx = dx2;
	
	c.begin();
	
	while (currDx < (w - Math.max(20, r)))
	{
		c.moveTo(currDx, 0);
		c.lineTo(currDx, h);
		
		currDx = currDx + dx2;
	}
	
	c.stroke();
	
	var w1 = Math.min(Math.max(20, r), h);
	var x1 = w - w1 * 0.5;
	var y1 = h * 0.5;
	
	c.setFillColor(mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, ''));
	c.begin();
	c.moveTo(x1 - w1 * 0.15, y1 - w1 * 0.225);
	c.lineTo(x1 + w1 * 0.25, y1);
	c.lineTo(x1 - w1 * 0.15, y1 + w1 * 0.225);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxShapeIOS7SelectBar.prototype.cst.SELECT_BAR, mxShapeIOS7SelectBar);

mxShapeIOS7SelectBar.prototype.constraints = null;

Graph.handleFactory[mxShapeIOS7SelectBar.prototype.cst.SELECT_BAR] = function(state)
{
	var handles = [Graph.createHandle(state, ['dx'], function(bounds)
			{
				var dx = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'dx', this.dx))));

				return new mxPoint(bounds.x + dx, bounds.y + bounds.height);
			}, function(bounds, pt)
			{
				var y = parseFloat(mxUtils.getValue(this.state.style, 'dy', this.dy)) * 0.6;
				this.state.style['dx'] = Math.round(100 * Math.max(y, Math.min(bounds.width - y, pt.x - bounds.x))) / 100;
			})];

	var handle2 = Graph.createHandle(state, ['dy'], function(bounds)
			{
				var dy = Math.max(0, Math.min(bounds.height, parseFloat(mxUtils.getValue(this.state.style, 'dy', this.dy))));

				return new mxPoint(bounds.x + parseFloat(mxUtils.getValue(this.state.style, 'dx', this.dx)), bounds.y + bounds.height + dy);
			}, function(bounds, pt)
			{
				this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(bounds.height, pt.y - bounds.y - bounds.height))) / 100;
			});

	handles.push(handle2);

	var handle3 = Graph.createHandle(state, ['size'], function(bounds)
			{
				var size = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'size', this.size))));

				return new mxPoint(bounds.x + bounds.width - size, bounds.y + 10);
			}, function(bounds, pt)
			{
				this.state.style['size'] = Math.round(100 * Math.max(0, Math.min(bounds.width / 2, bounds.height / 2, bounds.x + bounds.width - pt.x))) / 100;
			});
	
	handles.push(handle3);

	var handle4 = Graph.createHandle(state, ['dx2'], function(bounds)
			{
				var dx2 = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'dx2', this.dx2))));

				return new mxPoint(bounds.x + dx2, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(bounds.width, pt.x - bounds.x))) / 100;
			});

	handles.push(handle4);

	return handles;

}

//**********************************************************************************************************************************************************
//slider
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
//mxShapeIOS7SelectBar
function mxShapeIOS7Slider2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIOS7Slider2, mxShape);

mxShapeIOS7Slider2.prototype.cst = {
		SHAPE_SLIDER : 'mxgraph.ios7ui.slider',
		BAR_POS : 'barPos',
		HANDLE_SIZE : 'handleSize'
};

mxShapeIOS7Slider2.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, max:1, defVal:20},
	{name: 'handleSize', dispName: 'Handle Size', type: 'float', min:0, defVal:10}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIOS7Slider2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
};

mxShapeIOS7Slider2.prototype.background = function(c, x, y, w, h)
{
	var hSize = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7Slider2.prototype.cst.HANDLE_SIZE, '10'));
	var barPos = parseFloat(mxUtils.getValue(this.style, mxShapeIOS7Slider2.prototype.cst.BAR_POS, '40')) / 100;

	barPos = Math.max(0, Math.min(1, barPos));

	c.save();
	c.setStrokeColor('#bbbbbb');
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.fillAndStroke();
	

	c.restore();
	c.begin();
	c.moveTo(0, h * 0.5);
	c.lineTo(barPos * w, h * 0.5);
	c.fillAndStroke();
	
	c.setStrokeColor('#bbbbbb');
	c.begin();
	c.ellipse(barPos * w - hSize * 0.5, h * 0.5 - hSize * 0.5, hSize, hSize);
	c.fillAndStroke();

};

mxCellRenderer.registerShape(mxShapeIOS7Slider2.prototype.cst.SHAPE_SLIDER, mxShapeIOS7Slider2);

mxShapeIOS7Slider2.prototype.constraints = null;

Graph.handleFactory[mxShapeIOS7Slider2.prototype.cst.SHAPE_SLIDER] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 0.4))));

				return new mxPoint(bounds.x + barPos * bounds.width / 100, bounds.y + bounds.height / 2);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.x) * 100 / bounds.width))) / 100;
			})];
			
	return handles;
};

