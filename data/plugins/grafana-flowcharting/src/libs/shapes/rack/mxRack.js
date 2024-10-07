/**
 * $Id: mxRack.js,v 1.5 2014/01/21 13:10:37 gaudenz Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */
//**********************************************************************************************************************************************************
//Rack Numbering
//**********************************************************************************************************************************************************

//**********************************************************************************************************************************************************
// v2 Rack cabinet, old versions below this
//**********************************************************************************************************************************************************

//**********************************************************************************************************************************************************
//START LEGACY RACKS
//**********************************************************************************************************************************************************
function mxRackContainer(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackContainer, mxShape);

mxRackContainer.unitSize = 20;

mxRackContainer.prototype.cst = 
{
		SHAPE_RACK_CONTAINER : 'mxgraph.rackGeneral.container',
		TEXT_COLOR : 'textColor',
		NUMBER_DISPLAY : 'numDisp',
		OFF : 'off',
		DIR_ASC : 'ascend',
		DIR_DESC : 'descend'
};

mxRackContainer.prototype.customProperties = [
	{name: 'fillColor2', dispName: 'Cabinet Color', type: 'color'},
	{name: 'textColor', dispName: 'Numbers Color', type: 'color'},
	{name: 'numDisp', dispName: 'Display Numbers', type: 'enum',
		enumList: [{val: 'off', dispName: 'Off'}, {val: 'ascend', dispName: 'Ascending'}, {val: 'descend', dispName: 'Descending'}],
		onChange: function(graph, newValue)
		{
			graph.setCellStyles('marginLeft', (newValue == 'off') ? 9 : 33, graph.getSelectionCells());
		}
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxRackContainer.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fontSize = 12;
	var displayNumbers = mxUtils.getValue(this.style, mxRackContainer.prototype.cst.NUMBER_DISPLAY, mxRackContainer.prototype.cst.DIR_ASC);
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var fillColor2 = mxUtils.getValue(this.style, 'fillColor2', '#f4f4f4');

	if (displayNumbers !== mxRackContainer.prototype.cst.OFF)
	{
		c.translate(x + fontSize * 2, y);
		w = Math.max(w - fontSize * 2, 0);
	}
	else
	{
		c.translate(x, y);
	};

	c.setFillColor(fillColor);
	this.background(c, w, h, fontSize);
	c.setShadow(false);
	c.setFillColor(fillColor2);
	this.foreground(c, w, h, fontSize);

	if (displayNumbers !== mxRackContainer.prototype.cst.OFF && w > 18 + fontSize * 2)
	{
		this.sideText(c, w, h, fontSize);
	};
};

mxRackContainer.prototype.background = function(c, w, h, fontSize)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxRackContainer.prototype.foreground = function(c, w, h, fontSize)
{
	if (w > 18 + fontSize * 2 && h > 42)
	{
		c.rect(0, 0, w, 21);
		c.fillAndStroke();
		c.rect(0, h - 21, w, 21);
		c.fillAndStroke();
		c.rect(0, 21, 9, h - 42);
		c.fillAndStroke();
		c.rect(w - 9, 21, 9, h - 42);
		c.fillAndStroke();
		c.ellipse(2.5, 7.5, 6, 6);
		c.stroke();
		c.ellipse(w - 8.5, 7.5, 6, 6);
		c.stroke();
		c.ellipse(2.5, h - 13.5, 6, 6);
		c.stroke();
		c.ellipse(w - 8.5, h - 13.5, 6, 6);
		c.stroke();
	}
};

mxRackContainer.prototype.sideText = function(c, w, h, fontSize)
{
	var fontColor = mxUtils.getValue(this.style, mxRackContainer.prototype.cst.TEXT_COLOR, '#666666');
	var displayNumbers = mxUtils.getValue(this.style, mxRackContainer.prototype.cst.NUMBER_DISPLAY, mxRackContainer.prototype.cst.DIR_ASC);
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	// Calculate number of units
	var units = Math.floor((Math.abs(h) - 42) / mxRackContainer.unitSize);

	for (var i = 0; i < units; i++)
	{
		var displayNumber = (displayNumbers === mxRackContainer.prototype.cst.DIR_DESC) ? (i + 1).toString() : (units - i).toString();
		c.text(-fontSize, 21 + mxRackContainer.unitSize * 0.5 + i * mxRackContainer.unitSize, 0, 0, displayNumber, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}

	c.begin();

	for (var i = 0; i < units + 1; i++)
	{
		c.moveTo(-2 * fontSize, 21 + i * mxRackContainer.unitSize);
		c.lineTo(0, 21 + i * mxRackContainer.unitSize);
	};

	c.stroke();
};

/**
* Extends mxShape.
*/
function mxRackPlate(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = 1;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxRackPlate, mxShape);

mxRackPlate.prototype.cst = 
{
		SHAPE_RACK_PLATE : 'mxgraph.rackGeneral.plate'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackPlate.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackPlate.prototype.background = function(c, w, h)
{
	c.begin();
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxRackPlate.prototype.foreground = function(c, w, h)
{
	var bufferSize = 9;

	if (w > bufferSize * 2)
	{
		c.save();
		c.setFillColor('#000000');
		c.setAlpha(0.23);
		c.rect(0,0, bufferSize, h);
		c.fill();
		c.rect(w - bufferSize,0, bufferSize, h);
		c.fill();
		c.restore();
		c.rect(0, 0, w, h);
		c.stroke();
		c.rect(bufferSize, 0, w - bufferSize * 2, h);
		c.stroke();
	}
};

//**********************************************************************************************************************************************************
//Horizontal Cable Duct
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackHorCableDuct(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorCableDuct, mxShape);

mxRackHorCableDuct.prototype.cst = 
{
		SHAPE_RACK_HOR_CABLE_DUCT : 'mxgraph.rackGeneral.horCableDuct'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorCableDuct.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorCableDuct.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxRackHorCableDuct.prototype.foreground = function(c, w, h)
{
	// Divide the space equally with 33 between each duct
	var spaceBuffer = 20;
	var unitSpacing = 33;
	var unitsAcross = Math.floor((w - spaceBuffer) / unitSpacing);
	var buffer = spaceBuffer / 2 + Math.floor(((w - spaceBuffer) - unitsAcross * unitSpacing) / 2);

	if (unitsAcross > 0)
	{
		for (var i = 0; i <= unitsAcross; i++)
		{
			c.rect(buffer, 0, 3, 7);
			c.stroke();
			c.rect(buffer, 7, 3, 7.8);
			c.stroke();
			
			buffer += unitSpacing;
		}
	}
};

function mxRackHorRoutingBank(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorRoutingBank, mxShape);

mxRackHorRoutingBank.prototype.cst = 
{
		SHAPE_RACK_HOR_ROUTING_BANK : 'mxgraph.rackGeneral.horRoutingBank'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorRoutingBank.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorRoutingBank.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxRackHorRoutingBank.prototype.foreground = function(c, w, h)
{
	// Divide the space equally with 33 between each duct
	var spaceBuffer = 20;
	var unitSpacing = 22;
	var rectWidth = 16;
	var unitsAcross = Math.floor((w - spaceBuffer - rectWidth) / unitSpacing);
	var unitsDown = Math.floor(h / mxRackContainer.unitSize);

	if (unitsAcross > 0 && unitsDown > 0)
	{
		for (var i = 0; i < unitsDown; i++)
		{
			var buffer = (spaceBuffer + rectWidth) / 2 + Math.floor(((w - spaceBuffer - rectWidth) - unitsAcross * unitSpacing) / 2) - rectWidth / 2;

			for (var j = 0; j <= unitsAcross; j++)
			{
				c.rect(buffer, 4 + (i * mxRackContainer.unitSize), rectWidth, 6.8);
				c.stroke();
				
				buffer += unitSpacing;
			}
		}
	}
};

function mxRackNeatPatch(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackNeatPatch, mxShape);

mxRackNeatPatch.prototype.cst = 
{
		SHAPE_RACK_NEAT_PATCH : 'mxgraph.rackGeneral.neatPatch'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackNeatPatch.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.mainText(c, w, h);
};

mxRackNeatPatch.prototype.background = function(c, w, h)
{
	c.setFillColor('#666666');
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxRackNeatPatch.prototype.mainText = function(c, w, h)
{
	c.setFontSize('12');
	c.setFontColor('#ffffff');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.text(w / 2, h - 6, 0, 0, 'NEAT-PATCH', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

function mxRackShelf(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackShelf, mxShape);

mxRackShelf.prototype.cst = 
{
		SHAPE_RACK_SHELF : 'mxgraph.rackGeneral.shelf'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackShelf.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
};

mxRackShelf.prototype.background = function(c, w, h)
{
	c.setStrokeWidth(2);
	c.begin();
	c.moveTo(1, 0);
	c.lineTo(1, h - 1);
	c.lineTo(w - 1, h - 1);
	c.lineTo(w - 1, 1);
	c.fillAndStroke();
};

function mxRackRackNumbering(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackRackNumbering, mxShape);

mxRackRackNumbering.prototype.cst = 
{
		SHAPE_RACK_RACK_NUMBERING : 'mxgraph.rackGeneral.rackNumbering',
		UNIT_NUM : 'unitNum',
		UNIT_HEIGHT : 'unitHeight',
		TEXT_COLOR : 'textColor',
		NUM_DIR : 'numDir',
		DIR_ASC : 'ascend',
		DIR_DESC : 'descend',
		TEXT_SIZE : 'textSize'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxRackRackNumbering.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var unitNum = parseFloat(mxUtils.getValue(this.style, mxRackRackNumbering.prototype.cst.UNIT_NUM, '42'));
	var unitH = parseFloat(mxUtils.getValue(this.style, mxRackRackNumbering.prototype.cst.UNIT_HEIGHT, '14.8'));
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxRackRackNumbering.prototype.cst.TEXT_SIZE, '12'));
	c.translate(x, y);

	var h = unitNum * unitH;
	this.background(c, w, h, fontSize);
	c.setShadow(false);
	this.sideText(c, w, h, unitNum, unitH, fontSize);
};

mxRackRackNumbering.prototype.background = function(c, w, h, fontSize)
{
	c.rect(fontSize * 3, 0, 160.9, h);
	c.fillAndStroke();
};

mxRackRackNumbering.prototype.sideText = function(c, w, h, unitNum, unitH, fontSize)
{
	var fontColor = mxUtils.getValue(this.style, mxRackRackNumbering.prototype.cst.TEXT_COLOR, '#666666');
	var numDir = mxUtils.getValue(this.style, mxRackRackNumbering.prototype.cst.NUM_DIR, mxRackRackNumbering.prototype.cst.DIR_DESC);
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	if (numDir === mxRackRackNumbering.prototype.cst.DIR_ASC)
	{
		for (var i = 0; i < unitNum; i++)
		{
			c.text(fontSize, unitH * 0.5 + i * unitH, 0, 0, (i + 1).toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		};
	}
	else
	{
		for (var i = 0; i < unitNum; i++)
		{
			c.text(fontSize, h - unitH * 0.5 - i * unitH, 0, 0, (i + 1).toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		};
	};

	c.setStrokeColor('#dddddd');

	c.begin();

	for (var i = 0; i < unitNum + 1; i++)
	{
		c.moveTo(0, i * unitH);
		c.lineTo(fontSize * 3, i * unitH);
	};

	c.stroke();
};

//**********************************************************************************************************************************************************
//Rack Cabinet
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxRackRackCabinet(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackRackCabinet, mxShape);

mxRackRackCabinet.prototype.cst = 
{
		SHAPE_RACK_RACK_CABINET : 'mxgraph.rackGeneral.rackCabinet',
		UNIT_NUM : 'unitNum',
		UNIT_HEIGHT : 'unitHeight',
		TEXT_COLOR : 'textColor',
		NUM_DIR : 'numDir',
		NUMBER_DISPLAY : 'numDisp',
		ON : 'on',
		OFF : 'off',
		DIR_ASC : 'ascend',
		DIR_DESC : 'descend',
		TEXT_SIZE : 'textSize'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxRackRackCabinet.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var unitNum = parseFloat(mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.UNIT_NUM, '12'));
	var unitH = parseFloat(mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.UNIT_HEIGHT, '14.8'));
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.TEXT_SIZE, '12'));
	var numDis = mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.NUMBER_DISPLAY, mxRackRackCabinet.prototype.cst.ON);

	if (numDis === mxRackRackCabinet.prototype.cst.ON)
	{
		c.translate(x + fontSize * 2, y);
	}
	else
	{
		c.translate(x, y);
	};

	var h = unitNum * unitH + 42;
	this.background(c, w, h, fontSize);
	c.setShadow(false);
	this.foreground(c, w, h, fontSize);

	if (numDis === mxRackRackCabinet.prototype.cst.ON)
	{
		this.sideText(c, w, h, unitNum, unitH, fontSize);
	};
};

mxRackRackCabinet.prototype.background = function(c, w, h, fontSize)
{
	c.setFillColor('#ffffff');
	c.rect(0, 0, 180, h);
	c.fillAndStroke();
};

mxRackRackCabinet.prototype.foreground = function(c, w, h, fontSize)
{
	c.setFillColor('#f4f4f4');
	c.rect(0, 0, 180, 21);
	c.fillAndStroke();
	c.rect(0, h - 21, 180, 21);
	c.fillAndStroke();
	c.rect(0, 21, 9, h - 42);
	c.fillAndStroke();
	c.rect(171, 21, 9, h - 42);
	c.fillAndStroke();
	c.ellipse(2.5, 7.5, 6, 6);
	c.stroke();
	c.ellipse(171.5, 7.5, 6, 6);
	c.stroke();
	c.ellipse(2.5, h - 13.5, 6, 6);
	c.stroke();
	c.ellipse(171.5, h - 13.5, 6, 6);
	c.stroke();
};

mxRackRackCabinet.prototype.sideText = function(c, w, h, unitNum, unitH, fontSize)
{
	var fontColor = mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.TEXT_COLOR, '#666666');
	var numDir = mxUtils.getValue(this.style, mxRackRackCabinet.prototype.cst.NUM_DIR, mxRackRackCabinet.prototype.cst.DIR_DESC);
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	if (numDir === mxRackRackCabinet.prototype.cst.DIR_ASC)
	{
		for (var i = 0; i < unitNum; i++)
		{
			c.text(-fontSize, 21 + unitH * 0.5 + i * unitH, 0, 0, (i + 1).toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		};
	}
	else
	{
		for (var i = 0; i < unitNum; i++)
		{
			c.text(-fontSize, h - 21 - unitH * 0.5 - i * unitH, 0, 0, (i + 1).toString(), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		};
	};

	c.setStrokeColor('#dddddd');

	c.begin();

	for (var i = 0; i < unitNum + 1; i++)
	{
		c.moveTo(-2 * fontSize, 21 + i * unitH);
		c.lineTo(0, 21 + i * unitH);
	};

	c.stroke();
};

//**********************************************************************************************************************************************************
//1U Horizontal Cable Duct
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackHorCableDuct1U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorCableDuct1U, mxShape);

mxRackHorCableDuct1U.prototype.cst = 
{
		SHAPE_RACK_HOR_CABLE_DUCT_1U : 'mxgraph.rackGeneral.horCableDuct1U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorCableDuct1U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorCableDuct1U.prototype.background = function(c, w, h)
{
	c.rect(0, 0, 160.9, 14.8);
	c.fillAndStroke();
};

mxRackHorCableDuct1U.prototype.foreground = function(c, w, h)
{
	c.rect(12, 0, 3, 7);
	c.stroke();
	c.rect(12, 7, 3, 7.8);
	c.stroke();

	c.rect(45.5, 0, 3, 7);
	c.stroke();
	c.rect(45.5, 7, 3, 7.8);
	c.stroke();
	
	c.rect(79, 0, 3, 7);
	c.stroke();
	c.rect(79, 7, 3, 7.8);
	c.stroke();
	
	c.rect(112.5, 0, 3, 7);
	c.stroke();
	c.rect(112.5, 7, 3, 7.8);
	c.stroke();
	
	c.rect(146, 0, 3, 7);
	c.stroke();
	c.rect(146, 7, 3, 7.8);
	c.stroke();
};

//**********************************************************************************************************************************************************
//2U Horizontal Cable Duct
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackHorCableDuct2U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorCableDuct2U, mxShape);

mxRackHorCableDuct2U.prototype.cst = 
{
		SHAPE_RACK_HOR_CABLE_DUCT_2U : 'mxgraph.rackGeneral.horCableDuct2U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorCableDuct2U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorCableDuct2U.prototype.background = function(c, w, h)
{
	c.rect(0, 0, 160.9, 29.6);
	c.fillAndStroke();
};

mxRackHorCableDuct2U.prototype.foreground = function(c, w, h)
{
	c.rect(12, 0, 3, 7);
	c.stroke();
	c.rect(12, 7, 3, 22.6);
	c.stroke();

	c.rect(45.5, 0, 3, 7);
	c.stroke();
	c.rect(45.5, 7, 3, 22.6);
	c.stroke();
	
	c.rect(79, 0, 3, 7);
	c.stroke();
	c.rect(79, 7, 3, 22.6);
	c.stroke();
	
	c.rect(112.5, 0, 3, 7);
	c.stroke();
	c.rect(112.5, 7, 3, 22.6);
	c.stroke();
	
	c.rect(146, 0, 3, 7);
	c.stroke();
	c.rect(146, 7, 3, 22.6);
	c.stroke();
};

//**********************************************************************************************************************************************************
//1U Cable Routing Bank
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackHorRoutingBank1U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorRoutingBank1U, mxShape);

mxRackHorRoutingBank1U.prototype.cst = 
{
		SHAPE_RACK_HOR_ROUTING_BANK_1U : 'mxgraph.rackGeneral.horRoutingBank1U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorRoutingBank1U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorRoutingBank1U.prototype.background = function(c, w, h)
{
	c.rect(0, 0, 160.9, 14.8);
	c.fillAndStroke();
};

mxRackHorRoutingBank1U.prototype.foreground = function(c, w, h)
{
	c.rect(10, 4, 17, 6.8);
	c.stroke();
	c.rect(31, 4, 17, 6.8);
	c.stroke();
	c.rect(52, 4, 17, 6.8);
	c.stroke();
	c.rect(73, 4, 17, 6.8);
	c.stroke();
	c.rect(94, 4, 17, 6.8);
	c.stroke();
	c.rect(115, 4, 17, 6.8);
	c.stroke();
	c.rect(136, 4, 17, 6.8);
	c.stroke();
};

//**********************************************************************************************************************************************************
//2U Cable Routing Bank
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackHorRoutingBank2U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackHorRoutingBank2U, mxShape);

mxRackHorRoutingBank2U.prototype.cst = 
{
		SHAPE_RACK_HOR_ROUTING_BANK_2U : 'mxgraph.rackGeneral.horRoutingBank2U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackHorRoutingBank2U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackHorRoutingBank2U.prototype.background = function(c, w, h)
{
	c.rect(0, 0, 160.9, 29.6);
	c.fillAndStroke();
};

mxRackHorRoutingBank2U.prototype.foreground = function(c, w, h)
{
	c.rect(10, 4, 17, 6.8);
	c.stroke();
	c.rect(31, 4, 17, 6.8);
	c.stroke();
	c.rect(52, 4, 17, 6.8);
	c.stroke();
	c.rect(73, 4, 17, 6.8);
	c.stroke();
	c.rect(94, 4, 17, 6.8);
	c.stroke();
	c.rect(115, 4, 17, 6.8);
	c.stroke();
	c.rect(136, 4, 17, 6.8);
	c.stroke();

	c.rect(10, 18.8, 17, 6.8);
	c.stroke();
	c.rect(31, 18.8, 17, 6.8);
	c.stroke();
	c.rect(52, 18.8, 17, 6.8);
	c.stroke();
	c.rect(73, 18.8, 17, 6.8);
	c.stroke();
	c.rect(94, 18.8, 17, 6.8);
	c.stroke();
	c.rect(115, 18.8, 17, 6.8);
	c.stroke();
	c.rect(136, 18.8, 17, 6.8);
	c.stroke();
};

//**********************************************************************************************************************************************************
//2U Neat-Patch
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackNeatPatch2U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackNeatPatch2U, mxShape);

mxRackNeatPatch2U.prototype.cst = 
{
		SHAPE_RACK_NEAT_PATCH_2U : 'mxgraph.rackGeneral.neatPatch2U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackNeatPatch2U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.mainText(c, w, h);
};

mxRackNeatPatch2U.prototype.background = function(c, w, h)
{
	c.setFillColor('#666666');
	c.rect(0, 0, 160.9, 29.6);
	c.fillAndStroke();
};

mxRackNeatPatch2U.prototype.mainText = function(c, w, h)
{
	c.setFontSize('12');
	c.setFontColor('#ffffff');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.text(80.45, 24, 0, 0, 'NEAT-PATCH', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

//**********************************************************************************************************************************************************
//1U shelf
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackShelf1U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackShelf1U, mxShape);

mxRackShelf1U.prototype.cst = 
{
		SHAPE_RACK_SHELF_1U : 'mxgraph.rackGeneral.shelf1U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackShelf1U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
};

mxRackShelf1U.prototype.background = function(c, w, h)
{
	c.setStrokeWidth(2);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, 14.8);
	c.lineTo(160.9, 14.8);
	c.lineTo(160.9, 0);
	c.fillAndStroke();
};

//**********************************************************************************************************************************************************
//2U shelf
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackShelf2U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackShelf2U, mxShape);

mxRackShelf2U.prototype.cst = 
{
		SHAPE_RACK_SHELF_2U : 'mxgraph.rackGeneral.shelf2U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackShelf2U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
};

mxRackShelf2U.prototype.background = function(c, w, h)
{
	c.setStrokeWidth(2);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, 29.6);
	c.lineTo(160.9, 29.6);
	c.lineTo(160.9, 0);
	c.fillAndStroke();
};

//**********************************************************************************************************************************************************
//4U shelf
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackShelf4U(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackShelf4U, mxShape);

mxRackShelf4U.prototype.cst = 
{
		SHAPE_RACK_SHELF_4U : 'mxgraph.rackGeneral.shelf4U'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackShelf4U.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
};

mxRackShelf4U.prototype.background = function(c, w, h)
{
	c.setStrokeWidth(2);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(0, 59.2);
	c.lineTo(160.9, 59.2);
	c.lineTo(160.9, 0);
	c.fillAndStroke();
};

//**********************************************************************************************************************************************************
//END LEGACY RACKS
//**********************************************************************************************************************************************************


//**********************************************************************************************************************************************************
//Channel Base
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackChannelBase(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackChannelBase, mxShape);

mxRackChannelBase.prototype.cst = 
{
		SHAPE_RACK_CHANNEL_BASE : 'mxgraph.rackGeneral.channelBase'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxRackChannelBase.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(w, 20);
	h = Math.max(h, 20);
	c.translate(x, y);

	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxRackChannelBase.prototype.background = function(c, w, h)
{
	c.rect(10, h - 15, 5, 15);
	c.fillAndStroke();
	c.rect(w - 15, h - 15, 5, 15);
	c.fillAndStroke();
	c.rect(0, 0, w, h - 5);
	c.fillAndStroke();
};

mxRackChannelBase.prototype.foreground = function(c, w, h)
{
	c.setFillColor('#000000');
	c.rect(10, h - 15, 5, 15);
	c.fillAndStroke();
	c.rect(w - 15, h - 15, 5, 15);
	c.fillAndStroke();
};

//**********************************************************************************************************************************************************
//Cabinet Leg
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxRackCabinetLeg(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxRackCabinetLeg, mxShape);

mxRackCabinetLeg.prototype.cst = 
{
		SHAPE_RACK_CABINET_LEG : 'mxgraph.rackGeneral.cabinetLeg'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxRackCabinetLeg.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(w, 20);
	h = Math.max(h, 20);
	c.translate(x, y);

	this.background(c, w, h);
};

mxRackCabinetLeg.prototype.background = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h - 10);
	c.lineTo(5, h - 10);
	c.lineTo(5, h - 12);
	c.lineTo(9, h - 12);
	c.lineTo(9, h - 10);
	c.lineTo(w - 10, h - 10);
	c.lineTo(w - 10, 9);
	c.lineTo(w - 12, 9);
	c.lineTo(w - 12, 5);
	c.lineTo(w - 10, 5);
	c.lineTo(w - 10, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

// New generic unit size implementations
mxCellRenderer.registerShape(mxRackContainer.prototype.cst.SHAPE_RACK_CONTAINER, mxRackContainer);
mxCellRenderer.registerShape(mxRackHorCableDuct.prototype.cst.SHAPE_RACK_HOR_CABLE_DUCT, mxRackHorCableDuct);
mxCellRenderer.registerShape(mxRackHorRoutingBank.prototype.cst.SHAPE_RACK_HOR_ROUTING_BANK, mxRackHorRoutingBank);
mxCellRenderer.registerShape(mxRackNeatPatch.prototype.cst.SHAPE_RACK_NEAT_PATCH, mxRackNeatPatch);
mxCellRenderer.registerShape(mxRackShelf.prototype.cst.SHAPE_RACK_SHELF, mxRackShelf);
mxCellRenderer.registerShape(mxRackPlate.prototype.cst.SHAPE_RACK_PLATE, mxRackPlate);

// Legacy resizable / fixed unit size implementations
mxCellRenderer.registerShape(mxRackRackNumbering.prototype.cst.SHAPE_RACK_RACK_NUMBERING, mxRackRackNumbering);
mxCellRenderer.registerShape(mxRackRackCabinet.prototype.cst.SHAPE_RACK_RACK_CABINET, mxRackRackCabinet);
mxCellRenderer.registerShape(mxRackHorCableDuct1U.prototype.cst.SHAPE_RACK_HOR_CABLE_DUCT_1U, mxRackHorCableDuct1U);
mxCellRenderer.registerShape(mxRackHorCableDuct2U.prototype.cst.SHAPE_RACK_HOR_CABLE_DUCT_2U, mxRackHorCableDuct2U);
mxCellRenderer.registerShape(mxRackHorRoutingBank1U.prototype.cst.SHAPE_RACK_HOR_ROUTING_BANK_1U, mxRackHorRoutingBank1U);
mxCellRenderer.registerShape(mxRackHorRoutingBank2U.prototype.cst.SHAPE_RACK_HOR_ROUTING_BANK_2U, mxRackHorRoutingBank2U);
mxCellRenderer.registerShape(mxRackNeatPatch2U.prototype.cst.SHAPE_RACK_NEAT_PATCH_2U, mxRackNeatPatch2U);
mxCellRenderer.registerShape(mxRackShelf1U.prototype.cst.SHAPE_RACK_SHELF_1U, mxRackShelf1U);
mxCellRenderer.registerShape(mxRackShelf2U.prototype.cst.SHAPE_RACK_SHELF_2U, mxRackShelf2U);
mxCellRenderer.registerShape(mxRackShelf4U.prototype.cst.SHAPE_RACK_SHELF_4U, mxRackShelf4U);

mxCellRenderer.registerShape(mxRackChannelBase.prototype.cst.SHAPE_RACK_CHANNEL_BASE, mxRackChannelBase);
mxCellRenderer.registerShape(mxRackCabinetLeg.prototype.cst.SHAPE_RACK_CABINET_LEG, mxRackCabinetLeg);