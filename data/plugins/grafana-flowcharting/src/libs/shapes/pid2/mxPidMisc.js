/**
 * $Id: mxPidMisc.js,v 1.4 2013/11/22 10:46:56 mate Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Fan
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidFan(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidFan, mxShape);

mxShapePidFan.prototype.cst = {
		SHAPE_FAN : 'mxgraph.pid2misc.fan',
		FAN_TYPE : 'fanType',
		COMMON : 'common',
		AXIAL : 'axial',
		RADIAL : 'radial'
};

mxShapePidFan.prototype.customProperties = [
	{name: 'fanType', dispName: 'Type', type: 'enum', defVal:'field',
		enumList: [
			{val:'common', dispName:'Common'},
			{val:'axial', dispName:'Axial'},
			{val:'radial', dispName:'Radial'}
	]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidFan.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidFan.prototype.background = function(c, x, y, w, h)
{
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapePidFan.prototype.foreground = function(c, x, y, w, h)
{

	c.begin();
	c.moveTo(w * 0.3, h * 0.045);
	c.lineTo(w * 0.97, h * 0.33);
	c.moveTo(w * 0.3, h * 0.955);
	c.lineTo(w * 0.97, h * 0.67);

	c.moveTo(w * 0.4228, h * 0.3655);
	c.arcTo(w * 0.15, h * 0.03, 50, 0, 1, w * 0.5, h * 0.5);
	c.arcTo(w * 0,15, h * 0.03, 50, 0, 1, w * 0.3772, h * 0.4045);
	c.arcTo(w * 0.15, h * 0.03, 50, 0, 1, w * 0.3025, h * 0.271);
	c.arcTo(w * 0.15, h * 0.03, 50, 0, 1, w * 0.4228, h * 0.3655);
	c.close();

	c.moveTo(w * 0.377, h * 0.5973);
	c.arcTo(w * 0.15, h * 0.03, -50, 0, 1, w * 0.4966, h * 0.5019);
	c.arcTo(w * 0,15, h * 0.03, -50, 0, 1, w * 0.423, h * 0.636);
	c.arcTo(w * 0.15, h * 0.03, -50, 0, 1, w * 0.3034, h * 0.7314);
	c.arcTo(w * 0.15, h * 0.03, -50, 0, 1, w * 0.377, h * 0.5973);
	c.close();
	c.stroke();

	c.ellipse(w * 0.5, h * 0.47, w * 0.3, h * 0.06);
	c.stroke();

	var type = mxUtils.getValue(this.style, mxShapePidFan.prototype.cst.FAN_TYPE, 'common');

	if (type === mxShapePidFan.prototype.cst.AXIAL)
	{
		c.begin();
		c.moveTo(w * 0.1, h * 0.5);
		c.lineTo(w * 0.3, h * 0.5);
		c.stroke();
	}
	else if (type === mxShapePidFan.prototype.cst.RADIAL)
	{
		c.begin();
		c.moveTo(w * 0.2, h * 0.4);
		c.lineTo(w * 0.2, h * 0.6);
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidFan.prototype.cst.SHAPE_FAN, mxShapePidFan);

//**********************************************************************************************************************************************************
//Column
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidColumn(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidColumn, mxShape);

mxShapePidColumn.prototype.cst = {
		SHAPE_COLUMN : 'mxgraph.pid2misc.column',
		COLUMN_TYPE : 'columnType',
		COMMON : 'common',
		FIXED : 'fixed',
		FLUIDIZED : 'fluid',
		BAFFLE : 'baffle',
		VALVE : 'valve',
		BUBBLE : 'bubble',
		NOZZLE : 'nozzle',
		TRAY : 'tray'
};

mxShapePidColumn.prototype.customProperties = [
	{name: 'columnType', dispName: 'Type', type: 'enum', defVal:'field',
		enumList: [
			{val:'common', dispName:'Common'},
			{val:'fixed', dispName:'Fixed'},
			{val:'fluid', dispName:'Fluid'},
			{val:'baffle', dispName:'Baffle'},
			{val:'valve', dispName:'Valve'},
			{val:'bubble', dispName:'Bubble'},
			{val:'nozzle', dispName:'Nozzle'},
			{val:'tray', dispName:'Tray'}
	]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidColumn.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapePidColumn.prototype.background = function(c, x, y, w, h)
{
	h = Math.max(h, 30);

	c.begin();
	c.moveTo(0, 15);
	c.arcTo(w * 0.5, 15, 0, 0, 1, w, 15);
	c.lineTo(w, h - 15);
	c.arcTo(w * 0.5, 15, 0, 0, 1, 0, h - 15);
	c.close();
	c.fillAndStroke();
};

mxShapePidColumn.prototype.foreground = function(c, x, y, w, h)
{
	var type = mxUtils.getValue(this.style, mxShapePidColumn.prototype.cst.COLUMN_TYPE, 'common');

	if (type === mxShapePidColumn.prototype.cst.FIXED)
	{
		var step = w * 1.2;
		var range = h - 50;
		var rem = range % step;
		var off = rem * 0.5 + 25;

		c.begin();

		for (var i = 0; i <= range - step; i += step)
		{
			c.moveTo(0, i + off + step * 0.1);
			c.lineTo(w, i + off + step * 0.1);
			c.moveTo(0, i + off + step * 0.9);
			c.lineTo(w, i + off + step * 0.9);
			c.moveTo(0, i + off + step * 0.1);
			c.lineTo(w, i + off + step * 0.9);
			c.moveTo(0, i + off + step * 0.9);
			c.lineTo(w, i + off + step * 0.1);
		}

		c.stroke();
	}
	else if (type === mxShapePidColumn.prototype.cst.TRAY)
	{
		var step = w * 0.2;
		var range = h - 50;
		var rem = range % step;
		var off = rem * 0.5 + 25;

		c.setDashed(true);
		c.begin();

		for (var i = 0; i <= range; i += step)
		{
			c.moveTo(0, i + off);
			c.lineTo(w, i + off);
		}

		c.stroke();
	}
	else if (type === mxShapePidColumn.prototype.cst.FLUIDIZED)
	{
		var stepY = w * 0.1;
		var stepX = w * 0.1;
		var range = h - 50;
		var rem = range % stepY;
		var off = 25;
		var dot = Math.min(w, h) * 0.02;
		var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
		var dashed = mxUtils.getValue(this.style, mxConstants.STYLE_DASHED, '0');
		var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
		var odd = 0;

		c.setFillColor(strokeColor);
		c.setDashed(true);
		c.begin();
		c.moveTo(0, 25);
		c.lineTo(w, 25);
		c.moveTo(0, h - 25);
		c.lineTo(w, h - 25);
		c.stroke();

		if (dashed === '0')
		{
			c.setDashed(false);
		}
		else
		{
			c.setDashed(true);
		}

		var counter = 0;

		for (var i = off + stepY * 0.5; i < range + off - dot; i += stepY)
		{
			var startJ = stepX;
			odd = counter % 2;

			if (odd === 0)
			{
				startJ = stepX * 0.5;
			}

			for (var j = startJ; j < w; j += stepX )
			{
				c.ellipse(j, i, dot, dot);
				c.fillAndStroke();
			}

			counter++;
		}
	}
	else if (type === mxShapePidColumn.prototype.cst.BAFFLE)
	{
		var stepY = w * 0.2;
		var range = h - 50 - stepY;
		var rem = range % stepY;
		var off = 25 + stepY * 0.5;
		var odd = 0;

		c.setDashed(true);
		c.begin();
		c.moveTo(0, 25);
		c.lineTo(w, 25);
		c.moveTo(0, h - 25);
		c.lineTo(w, h - 25);
		c.stroke();

		var counter = 0;

		c.begin();

		for (var i = off + stepY * 0.5; i < range + off; i += stepY)
		{
			odd = counter % 2;

			if (odd === 0)
			{
				c.moveTo(0, i);
				c.lineTo(w * 0.9, i);
				c.lineTo(w * 0.9, i - stepY * 0.3);
			}
			else
			{
				c.moveTo(w * 0.1, i - stepY * 0.5);
				c.lineTo(w * 0.1, i);
				c.lineTo(w, i);
			}


			counter++;
		}

		c.stroke();
	}
	else if (type === mxShapePidColumn.prototype.cst.VALVE || type === mxShapePidColumn.prototype.cst.BUBBLE)
	{
		var stepY = w * 0.2;
		var range = h - 50 - stepY;
		var rem = range % stepY;
		var off = 25 + stepY * 0.5;
		var dashed = mxUtils.getValue(this.style, mxConstants.STYLE_DASHED, '0');
		var odd = 0;

		c.setFillColor(strokeColor);
		c.setDashed(true);
		c.begin();
		c.moveTo(0, 25);
		c.lineTo(w, 25);
		c.moveTo(0, h - 25);
		c.lineTo(w, h - 25);
		c.stroke();

		if (dashed === '0')
		{
			c.setDashed(false);
		}
		else
		{
			c.setDashed(true);
		}
		
		c.begin();

		for (var i = off + stepY * 0.5; i < range + off; i += stepY)
		{
				c.moveTo(0, i);
				c.lineTo(w * 0.4, i);
				
				if (type === mxShapePidColumn.prototype.cst.VALVE)
				{
					c.moveTo(w * 0.4, i - stepY * 0.2);
					c.lineTo(w * 0.6, i - stepY * 0.2);
				}
				else if (type === mxShapePidColumn.prototype.cst.BUBBLE)
				{
					c.moveTo(w * 0.25, i - stepY * 0.2);
					c.arcTo(stepY * 3, stepY * 3, 0, 0, 1, w * 0.75, i - stepY * 0.2);
				}

				c.moveTo(w * 0.6, i);
				c.lineTo(w, i);
		}

		c.stroke();
	}
	else if (type === mxShapePidColumn.prototype.cst.NOZZLE)
	{
		var step = w * 1.2;
		var range = h - 50;
		var rem = range % step;
		var off = rem * 0.5 + 25;
		var dashed = mxUtils.getValue(this.style, mxConstants.STYLE_DASHED, 0);


		for (var i = 0; i <= range - step; i += step)
		{
			c.setDashed(true);
			
			c.begin();
			c.moveTo(0, i + off + step * 0.2);
			c.lineTo(w, i + off + step * 0.2);
			c.moveTo(0, i + off + step * 0.8);
			c.lineTo(w, i + off + step * 0.8);
			c.stroke();
			
			if (dashed === 0)
			{
				c.setDashed(false);
			}
			else
			{
				c.setDashed(true);
			}

			c.begin();
			c.moveTo(0, i + off + step * 0.2);
			c.lineTo(w, i + off + step * 0.8);
			c.moveTo(0, i + off + step * 0.8);
			c.lineTo(w, i + off + step * 0.2);

			if (i !== 0)
			{
				c.moveTo(0, i + off);
				c.lineTo(w * 0.5, i + off);
				c.moveTo(w * 0.5 - step * 0.08, i + off + step * 0.08);
				c.lineTo(w * 0.5, i + off);
				c.lineTo(w * 0.5 + step * 0.08, i + off + step * 0.08);
				c.moveTo(w * 0.5, i + off);
				c.lineTo(w * 0.5, i + off + step * 0.08);
			}
			
			c.stroke();
		}
		
		c.stroke();
	}
};

mxCellRenderer.registerShape(mxShapePidColumn.prototype.cst.SHAPE_COLUMN, mxShapePidColumn);

//**********************************************************************************************************************************************************
//Conveyor
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapePidConveyor(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapePidConveyor, mxShape);

mxShapePidConveyor.prototype.cst = {
		SHAPE_CONVEYOR : 'mxgraph.pid2misc.conveyor'
};

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapePidConveyor.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
};

mxShapePidConveyor.prototype.background = function(c, x, y, w, h)
{
	var wheelSize = Math.min(h, w * 0.5);

	c.begin();
	c.moveTo(wheelSize * 0.5, 0);
	c.lineTo(w - wheelSize * 0.5, 0);
	c.stroke();

	c.ellipse(0, 0, wheelSize, wheelSize);
	c.fillAndStroke();
	c.ellipse(w - wheelSize, 0, wheelSize, wheelSize);
	c.fillAndStroke();

	c.begin();
	c.moveTo(wheelSize * 0.5, wheelSize);
	c.lineTo(w - wheelSize * 0.5, wheelSize);
	c.stroke();

	//holders

	var dist = w - wheelSize * 1.8;
	var startX = wheelSize * 0.9;
	var step = wheelSize * 0.7;

	for (var i = 0; i < dist; i = i + step)
	{
		c.rect(startX + i, 0, wheelSize * 0.2, wheelSize * 0.1);
		c.fillAndStroke();
		c.rect(startX + i, wheelSize * 0.9, wheelSize * 0.2, wheelSize * 0.1);
		c.fillAndStroke();
	}

};

mxCellRenderer.registerShape(mxShapePidConveyor.prototype.cst.SHAPE_CONVEYOR, mxShapePidConveyor);

