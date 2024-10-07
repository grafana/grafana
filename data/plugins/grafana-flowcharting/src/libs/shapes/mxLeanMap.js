/**
 * $Id: mxLeanMap.js,v 1.3 2013/05/30 14:19:14 mate Exp $
 * Copyright (c) 2006-2013, JGraph Ltd
 */

//**********************************************************************************************************************************************************
//Boat Shipment
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanBoatShipment(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanBoatShipment, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanBoatShipment.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(w * 0.15, h * 0.77);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w * 0.85, h * 0.77);
	c.close();
	c.moveTo(w * 0.2, h);
	c.lineTo(0, h * 0.8);
	c.lineTo(w, h * 0.8);
	c.lineTo(w * 0.8, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.boat_shipment', mxLeanBoatShipment);

mxLeanBoatShipment.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), false),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), false),
                                            new mxConnectionConstraint(new mxPoint(0, 0.8), false),
                                            new mxConnectionConstraint(new mxPoint(1, 0.8), false),
                                            new mxConnectionConstraint(new mxPoint(0.2, 1), false),
                                            new mxConnectionConstraint(new mxPoint(0.8, 1), false),
                                            new mxConnectionConstraint(new mxPoint(0.26, 0.5), false),
                                            new mxConnectionConstraint(new mxPoint(0.74, 0.5), false)
                                            ];

//**********************************************************************************************************************************************************
//Safety Stock
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanSafetyStock(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanSafetyStock, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanSafetyStock.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxLeanSafetyStock.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxLeanSafetyStock.prototype.foreground = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.34);
	c.lineTo(w, h * 0.34);
	c.moveTo(0, h * 0.66);
	c.lineTo(w, h * 0.66);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.buffer_or_safety_stock', mxLeanSafetyStock);

mxLeanSafetyStock.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Data Box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanDataBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanDataBox, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanDataBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxLeanDataBox.prototype.background = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.fillAndStroke();
};

mxLeanDataBox.prototype.foreground = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.2);
	c.lineTo(w, h * 0.2);
	c.moveTo(0, h * 0.4);
	c.lineTo(w, h * 0.4);
	c.moveTo(0, h * 0.6);
	c.lineTo(w, h * 0.6);
	c.moveTo(0, h * 0.8);
	c.lineTo(w, h * 0.8);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.data_box', mxLeanDataBox);

mxLeanDataBox.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Customer / Supplier
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanCustomerSupplier(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanCustomerSupplier, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanCustomerSupplier.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, w, h);
	c.setShadow(false);
};

mxLeanCustomerSupplier.prototype.background = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h);
	c.lineTo(0, h * 0.3);
	c.lineTo(w * 0.33, h * 0.02);
	c.lineTo(w * 0.33, h * 0.3);
	c.lineTo(w * 0.67, h * 0.02);
	c.lineTo(w * 0.67, h * 0.3);
	c.lineTo(w, h * 0.02);
	c.lineTo(w, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.outside_sources', mxLeanCustomerSupplier);

mxLeanCustomerSupplier.prototype.constraints = [
                                       new mxConnectionConstraint(new mxPoint(1, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 1), true),
                                       new mxConnectionConstraint(new mxPoint(1, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.33, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.67, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.3), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                       ];

//**********************************************************************************************************************************************************
//Dedicated Process
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanDedicatedProcess(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanDedicatedProcess, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanDedicatedProcess.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8'));

	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h, fontSize);
};

mxLeanDedicatedProcess.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxLeanDedicatedProcess.prototype.foreground = function(c, w, h, fontSize)
{
	var lineH = Math.min(fontSize * 1.5, h);
	c.begin();
	c.moveTo(0, lineH);
	c.lineTo(w, lineH);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.manufacturing_process', mxLeanDedicatedProcess);

mxLeanDedicatedProcess.prototype.constraints = [
                                       new mxConnectionConstraint(new mxPoint(0, 0), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 1), true),
                                       new mxConnectionConstraint(new mxPoint(1, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                       new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                       new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                       new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                       ];

//**********************************************************************************************************************************************************
//Shared Process
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxLeanSharedProcess(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanSharedProcess, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxLeanSharedProcess.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8'));

	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h, fontSize);
};

mxLeanSharedProcess.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxLeanSharedProcess.prototype.foreground = function(c, w, h, fontSize)
{
	var lineH = Math.min(fontSize * 1.5, h);
	c.begin();
	c.moveTo(0, lineH);
	c.lineTo(w, lineH);
	c.stroke();

	var start = 0;
	var i = 0;
	var s = 10;
	var offset = 0;
	c.begin();
	var strokeWidth = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '2'));
	c.setStrokeWidth(strokeWidth * 0.5);

	while (start < h + w)
	{
		start = start + s;
		if (start > lineH)
		{
			var startX = Math.max(0, start - h); 
			var startY = Math.min(start, h); 

			var endX = Math.min(start - lineH, w);

			var endY = lineH;
			var endY = Math.max(start - w, lineH);
			
			if (startX < w)
			{
				c.moveTo(startX, startY);
				c.lineTo(endX, endY);
			}
		}
	};

	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.manufacturing_process_shared', mxLeanSharedProcess);

mxLeanSharedProcess.prototype.constraints = [
                                                new mxConnectionConstraint(new mxPoint(0, 0), true),
                                                new mxConnectionConstraint(new mxPoint(1, 0), true),
                                                new mxConnectionConstraint(new mxPoint(0, 1), true),
                                                new mxConnectionConstraint(new mxPoint(1, 1), true),
                                                new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                                new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                                new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                                new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                                new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                                new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                                new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                                new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                                new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                                new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                                new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                                new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                                ];

//**********************************************************************************************************************************************************
// Workcell
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanWorkcell(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanWorkcell, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanWorkcell.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(w * 0.65, h);
	c.lineTo(w * 0.65, h * 0.4);
	c.lineTo(w * 0.35, h * 0.4);
	c.lineTo(w * 0.35, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.work_cell', mxLeanWorkcell);

mxLeanWorkcell.prototype.constraints = [
                                             new mxConnectionConstraint(new mxPoint(0, 0), true),
                                             new mxConnectionConstraint(new mxPoint(1, 0), true),
                                             new mxConnectionConstraint(new mxPoint(0, 1), true),
                                             new mxConnectionConstraint(new mxPoint(1, 1), true),
                                             new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                             new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                             new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                             new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                             new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                             new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                             new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                             new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                             new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                             new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                             new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                             ];

//**********************************************************************************************************************************************************
//Inventory Box
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanInventoryBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanInventoryBox, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanInventoryBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.begin();
	c.moveTo(0, h);
	c.lineTo(w * 0.5, 0);
	c.lineTo(w, h);
	c.close();
	c.fillAndStroke();
	c.setShadow(false);
	c.begin();
	c.moveTo(w * 0.4, h * 0.45);
	c.lineTo(w * 0.6, h * 0.45);
	c.moveTo(w * 0.5, h * 0.45);
	c.lineTo(w * 0.5, h * 0.85);
	c.moveTo(w * 0.4, h * 0.85);
	c.lineTo(w * 0.6, h * 0.85);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.inventory_box', mxLeanInventoryBox);

mxLeanInventoryBox.prototype.constraints = [
                                             new mxConnectionConstraint(new mxPoint(0, 1), true),
                                             new mxConnectionConstraint(new mxPoint(1, 1), true),
                                             new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                             new mxConnectionConstraint(new mxPoint(0.375, 0.25), false),
                                             new mxConnectionConstraint(new mxPoint(0.25, 0.5), false),
                                             new mxConnectionConstraint(new mxPoint(0.125, 0.75), false),
                                             new mxConnectionConstraint(new mxPoint(0.625, 0.25), false),
                                             new mxConnectionConstraint(new mxPoint(0.75, 0.5), false),
                                             new mxConnectionConstraint(new mxPoint(0.875, 0.75), false),
                                             new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                             new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                             new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                             ];

//**********************************************************************************************************************************************************
//Push Arrow
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanPushArrow(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanPushArrow, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanPushArrow.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, w, h);
	c.setShadow(false);
	this.foreground(c, w, h);
};

mxLeanPushArrow.prototype.background = function(c, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.17);
	c.lineTo(w * 0.75, h * 0.17);
	c.lineTo(w * 0.75, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.75, h);
	c.lineTo(w * 0.75, h * 0.83);
	c.lineTo(0, h * 0.83);
	c.close();
	c.fillAndStroke();
};

mxLeanPushArrow.prototype.foreground = function(c, w, h, fontSize)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.rect(0, h * 0.17, w * 0.12, h * 0.66);
	c.fill();
	c.rect(w * 0.24, h * 0.17, w * 0.12, h * 0.66);
	c.fill();
	c.rect(w * 0.48, h * 0.17, w * 0.12, h * 0.66);
	c.fill();
	
	c.begin();
	c.moveTo(w * 0.72, h * 0.17);
	c.lineTo(w * 0.75, h * 0.17);
	c.lineTo(w * 0.75, 0);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.75, h);
	c.lineTo(w * 0.75, h * 0.83);
	c.lineTo(w * 0.72, h * 0.83);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.push_arrow', mxLeanPushArrow);

mxLeanPushArrow.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0.25, 0.17), false),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0.17), false),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.17), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.83), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0.83), false),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0.83), false),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Supermarket
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanSupermarket(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanSupermarket, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanSupermarket.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.lineTo(w, h);
	c.lineTo(0, h);
	c.moveTo(0, h * 0.33);
	c.lineTo(w, h * 0.33);
	c.moveTo(0, h * 0.67);
	c.lineTo(w, h * 0.67);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.supermarket', mxLeanSupermarket);

mxLeanSupermarket.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Material Pull
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanMaterialPull(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanMaterialPull, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanMaterialPull.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.begin();
	c.moveTo(w * 0.732, h * 0.0736);
	c.arcTo(w * 0.4827, h * 0.4959, 0, 1, 0, w * 0.9553, h * 0.6191);
	c.stroke();
	
	c.begin();
	c.moveTo(w * 0.9071, h * 0.6191);
	c.lineTo(w * 0.9794, h * 0.4951);
	c.lineTo(w, h * 0.6438);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.physical_pull', mxLeanMaterialPull);

mxLeanMaterialPull.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0.98, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0.144, 0.144), false),
                                           new mxConnectionConstraint(new mxPoint(0.144, 0.845), false),
                                           new mxConnectionConstraint(new mxPoint(0.845, 0.845), false)
                                           ];

//**********************************************************************************************************************************************************
//FIFO Lane
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanFifoLane(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanFifoLane, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanFifoLane.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var fontSize = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8'));

	this.background(c, w, h, fontSize);
	c.setShadow(false);
};

mxLeanFifoLane.prototype.background = function(c, w, h, fontSize)
{
	var lineH = Math.min(fontSize * 1.5, h);
	c.begin();
	c.moveTo(0, lineH);
	c.lineTo(w, lineH);
	c.moveTo(0, h);
	c.lineTo(w, h);
	c.stroke();

	c.rect(w * 0.02, lineH + 4, w * 0.26, h - lineH - 8);
	c.fillAndStroke();
	
	c.ellipse(w * 0.35, lineH + 4, w * 0.26, h - lineH - 8);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.69, lineH + 4);
	c.lineTo(w * 0.98, lineH + 4);
	c.lineTo(w * 0.835, h - 4);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.fifo_lane', mxLeanFifoLane);

mxLeanFifoLane.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Truck Shipment
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanTruckShipment(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanTruckShipment, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanTruckShipment.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	this.background(c, w, h);
	c.setShadow(false);
};

mxLeanTruckShipment.prototype.background = function(c, w, h)
{
	c.rect(0, 0, w * 0.6, h * 0.8);
	c.fillAndStroke();
	
	c.rect(w * 0.6, h * 0.35, w * 0.4, h * 0.45);
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.ellipse(w * 0.15, h * 0.8, w * 0.2, h * 0.2);
	c.fillAndStroke();
	
	c.ellipse(w * 0.65, h * 0.8, w * 0.2, h * 0.2);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.truck_shipment', mxLeanTruckShipment);

mxLeanTruckShipment.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.6, 0.35), false),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0.8), false),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Production Control
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanProductionControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanProductionControl, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanProductionControl.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.schedule', mxLeanProductionControl);

mxLeanProductionControl.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];


//**********************************************************************************************************************************************************
//FIFO Sequence
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanFifoSequence(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanFifoSequence, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanFifoSequence.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w, 0);
	c.moveTo(0, h);
	c.lineTo(w, h);
	c.moveTo(w * 0.05, h * 0.5);
	c.lineTo(w * 0.15, h * 0.5);
	c.moveTo(w * 0.75, h * 0.5);
	c.lineTo(w * 0.88, h * 0.5);
	c.stroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.88, h * 0.39);
	c.lineTo(w * 0.98, h * 0.5);
	c.lineTo(w * 0.88, h * 0.61);
	c.fillAndStroke();
	
//	c.setFontSize(Math.min(h * 0.5, w * 0.2));
//	c.setFontColor(strokeColor);
//	c.text(w * 0.5, h * 0.5, 0, 0, 'FIFO', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.fifo_sequence_flow', mxLeanFifoSequence);

mxLeanFifoSequence.prototype.constraints = [
                                                 new mxConnectionConstraint(new mxPoint(0, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(1, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(0, 1), true),
                                                 new mxConnectionConstraint(new mxPoint(1, 1), true),
                                                 new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                                 new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                                 new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                                 new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                                 new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                                 new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                                 ];

//**********************************************************************************************************************************************************
//Production Kanban
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanProductionKanban(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanProductionKanban, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanProductionKanban.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setDashed(true);
	c.begin();
	c.moveTo(4, h - 10);
	c.lineTo(4, 25);
	c.lineTo(w, 25);
	c.stroke();

	c.setDashed(false);
	c.begin();
	c.moveTo(w - 75, 0);
	c.lineTo(w - 30, 0);
	c.lineTo(w - 15, 15);
	c.lineTo(w - 15, 50);
	c.lineTo(w - 75, 50);
	c.close();
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(0, h - 10);
	c.lineTo(4, h);
	c.lineTo(8, h - 10);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.production_kanban', mxLeanProductionKanban);

mxLeanProductionKanban.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 4, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, 25));

	return (constr);
};

//**********************************************************************************************************************************************************
//Withdrawal Kanban
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanWithdrawalKanban(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanWithdrawalKanban, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanWithdrawalKanban.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setDashed(true);
	c.begin();
	c.moveTo(4, h - 10);
	c.lineTo(4, 25);
	c.lineTo(w, 25);
	c.stroke();

	c.setDashed(false);
	c.begin();
	c.moveTo(w - 75, 0);
	c.lineTo(w - 30, 0);
	c.lineTo(w - 15, 15);
	c.lineTo(w - 15, 50);
	c.lineTo(w - 75, 50);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w - 75, 45);
	c.lineTo(w - 70, 50);
	c.moveTo(w - 75, 35);
	c.lineTo(w - 60, 50);
	c.moveTo(w - 75, 25);
	c.lineTo(w - 50, 50);
	c.moveTo(w - 75, 15);
	c.lineTo(w - 40, 50);
	c.moveTo(w - 75, 5);
	c.lineTo(w - 30, 50);
	c.moveTo(w - 70, 0);
	c.lineTo(w - 20, 50);
	c.moveTo(w - 60, 0);
	c.lineTo(w - 15, 45);
	c.moveTo(w - 50, 0);
	c.lineTo(w - 15, 35);
	c.moveTo(w - 40, 0);
	c.lineTo(w - 15, 25);
	c.stroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(0, h - 10);
	c.lineTo(4, h);
	c.lineTo(8, h - 10);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.withdrawal_kanban', mxLeanWithdrawalKanban);

mxLeanWithdrawalKanban.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 4, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, 25));

	return (constr);
};

//**********************************************************************************************************************************************************
//Signal Kanban
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanSignalKanban(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanSignalKanban, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanSignalKanban.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.setDashed(true);
	c.begin();
	c.moveTo(4, h - 10);
	c.lineTo(4, 15);
	c.lineTo(w, 15);
	c.stroke();

	c.setDashed(false);
	c.begin();
	c.moveTo(w - 65, 0);
	c.lineTo(w - 25, 0);
	c.lineTo(w - 45, 45);
	c.close();
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(0, h - 10);
	c.lineTo(4, h);
	c.lineTo(8, h - 10);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.signal_kanban', mxLeanSignalKanban);

mxLeanSignalKanban.prototype.getConstraints = function(style, w, h)
{
	var constr = [];

	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, 4, h));
	constr.push(new mxConnectionConstraint(new mxPoint(0, 0), false, null, w, 15));

	return (constr);
};

//**********************************************************************************************************************************************************
//Sequenced Pull Ball
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanSequencedPullBall(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanSequencedPullBall, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanSequencedPullBall.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.setShadow(false);
	
	c.ellipse(w * 0.15, h * 0.15, w * 0.7, h * 0.7);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.sequenced_pull_ball', mxLeanSequencedPullBall);

mxLeanSequencedPullBall.prototype.constraints = [
                                            new mxConnectionConstraint(new mxPoint(0.144, 0.144), false),
                                            new mxConnectionConstraint(new mxPoint(0.856, 0.144), false),
                                            new mxConnectionConstraint(new mxPoint(0.856, 0.856), false),
                                            new mxConnectionConstraint(new mxPoint(0.144, 0.856), false),
                                            new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                            new mxConnectionConstraint(new mxPoint(0.5, 1), true)
                                            ];

//**********************************************************************************************************************************************************
//Rail Shipment
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanRailShipment(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanRailShipment, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanRailShipment.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	c.rect(w * 0.1, 0, w * 0.35, h * 0.8);
	c.fillAndStroke();
	c.rect(w * 0.55, 0, w * 0.35, h * 0.8);
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(0, h);
	c.lineTo(w, h);
	c.moveTo(w * 0.45, h * 0.7);
	c.lineTo(w * 0.55, h * 0.7);
	c.stroke();
	
	c.ellipse(w * 0.15, h * 0.8, w * 0.06, h * 0.2);
	c.fillAndStroke();
	c.ellipse(w * 0.34, h * 0.8, w * 0.06, h * 0.2);
	c.fillAndStroke();
	c.ellipse(w * 0.6, h * 0.8, w * 0.06, h * 0.2);
	c.fillAndStroke();
	c.ellipse(w * 0.79, h * 0.8, w * 0.06, h * 0.2);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.rail_shipment', mxLeanRailShipment);

mxLeanRailShipment.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.1, 0.25), false),
                                           new mxConnectionConstraint(new mxPoint(0.1, 0.5), false),
                                           new mxConnectionConstraint(new mxPoint(0.1, 0.75), false),
                                           new mxConnectionConstraint(new mxPoint(0.9, 0.25), false),
                                           new mxConnectionConstraint(new mxPoint(0.9, 0.5), false),
                                           new mxConnectionConstraint(new mxPoint(0.9, 0.75), false),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Warehouse
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanWarehouse(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanWarehouse, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanWarehouse.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	c.begin();
	c.moveTo(0, h * 0.4);
	c.lineTo(w, h * 0.4);
	c.moveTo(w * 0.15, h);
	c.lineTo(w * 0.15, h * 0.55);
	c.lineTo(w * 0.3, h * 0.55);
	c.lineTo(w * 0.3, h);
	c.stroke();

	c.ellipse(w * 0.27, h * 0.75, w * 0.02, w * 0.02);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.warehouse', mxLeanWarehouse);

mxLeanWarehouse.prototype.constraints = [
                                           new mxConnectionConstraint(new mxPoint(0, 0), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 1), true),
                                           new mxConnectionConstraint(new mxPoint(1, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                           new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                           new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                           new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                           ];

//**********************************************************************************************************************************************************
//Timeline
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanTimeline(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanTimeline, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanTimeline.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	
	var shapeInfo = mxUtils.getValue(this.style, 'mainText', '20,Time 1,50,Time 2,30,Time 3,40,Time 4,30,Time 5,50,Time 6,20,Time 7').toString().split(',');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '12');
	var times = new Array();
	var totalTime = 0;
	
	for (var i = 0; i < shapeInfo.length; i = i + 2)
	{
		var currTime = parseFloat(shapeInfo[i]); 
		times.push(currTime);
		totalTime = totalTime + currTime;
	};
	
	var scaleX = w / totalTime;
	var names = new Array();
	
	for (var i = 1; i < shapeInfo.length; i = i + 2)
	{
		names.push(shapeInfo[i]);
	};
	
	c.begin();
	var currX = 0;
	c.moveTo(0, h);
	
	for (var i = 0; i < names.length; i++)
	{
		var currTime = times[i] * scaleX;
		currX = currX + currTime;
		
		if (i % 2 === 0)
		{
			c.lineTo(currX, h);
			c.lineTo(currX, fontSize * 1.5);
			c.text(currX - currTime * 0.5, h - fontSize * 0.75, 0, 0, names[i], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}
		else
		{
			c.lineTo(currX, fontSize * 1.5);
			c.lineTo(currX, h);
			c.text(currX - currTime * 0.5, fontSize * 0.75, 0, 0, names[i], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}
	};
	
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.timeline', mxLeanTimeline);

//**********************************************************************************************************************************************************
//Cross Dock
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanCrossDock(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanCrossDock, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanCrossDock.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, 0, w, h);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	c.begin();
	c.moveTo(0, h * 0.25);
	c.lineTo(w, h * 0.25);
	
	c.moveTo(w * 0.1, h * 0.4);
	c.lineTo(w * 0.35, h * 0.4);
	c.arcTo(w * 0.15, h * 0.15, 0, 0, 1, w * 0.5, h * 0.5);
	c.arcTo(w * 0.15, h * 0.15, 0, 0, 0, w * 0.65, h * 0.6);
	c.lineTo(w * 0.9, h * 0.6);
	c.stroke();

	c.moveTo(w * 0.1, h * 0.4);
	c.lineTo(w * 0.35, h * 0.4);
	c.arcTo(w * 0.15, h * 0.25, 0, 0, 1, w * 0.5, h * 0.55);
	c.arcTo(w * 0.15, h * 0.25, 0, 0, 0, w * 0.65, h * 0.7);
	c.lineTo(w * 0.9, h * 0.7);
	c.stroke();

	c.moveTo(w * 0.1, h * 0.4);
	c.lineTo(w * 0.35, h * 0.4);
	c.arcTo(w * 0.15, h * 0.3, 0, 0, 1, w * 0.5, h * 0.6);
	c.arcTo(w * 0.15, h * 0.3, 0, 0, 0, w * 0.65, h * 0.8);
	c.lineTo(w * 0.9, h * 0.8);
	c.stroke();

	c.moveTo(w * 0.1, h * 0.8);
	c.lineTo(w * 0.35, h * 0.8);
	c.arcTo(w * 0.15, h * 0.3, 0, 0, 0, w * 0.5, h * 0.6);
	c.arcTo(w * 0.15, h * 0.3, 0, 0, 1, w * 0.65, h * 0.4);
	c.lineTo(w * 0.9, h * 0.4);
	c.stroke();

	c.moveTo(w * 0.1, h * 0.8);
	c.lineTo(w * 0.35, h * 0.8);
	c.arcTo(w * 0.15, h * 0.1, 0, 0, 0, w * 0.5, h * 0.75);
	c.arcTo(w * 0.15, h * 0.1, 0, 0, 1, w * 0.65, h * 0.7);
	c.lineTo(w * 0.9, h * 0.7);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.crossDock', mxLeanCrossDock);

mxLeanCrossDock.prototype.constraints = [
                                         new mxConnectionConstraint(new mxPoint(0, 0), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0, 1), true),
                                         new mxConnectionConstraint(new mxPoint(1, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.25), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.5), true),
                                         new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                         ];

//**********************************************************************************************************************************************************
//Orders
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanOrders(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanOrders, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanOrders.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.rect(0, h * 0.56, w, h * 0.44);
	c.fillAndStroke();
	
	var strokeWidth = parseFloat(mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '2'));
	c.setStrokeWidth(strokeWidth * 0.5);
	
	c.begin();
	c.moveTo(w * 0.04, h * 0.5418);
	c.lineTo(w * 0.94, h * 0.5418);
	c.moveTo(w * 0.0522, h * 0.5088);
	c.lineTo(w * 0.9522, h * 0.5088);
	c.moveTo(w * 0.05, h * 0.4738);
	c.lineTo(w * 0.95, h * 0.4738);
	c.moveTo(w * 0.0456, h * 0.4427);
	c.lineTo(w * 0.9456, h * 0.4427);
	c.moveTo(w * 0.0422, h * 0.4135);
	c.lineTo(w * 0.9422, h * 0.4135);
	c.moveTo(w * 0.0533, h * 0.3804);
	c.lineTo(w * 0.9533, h * 0.3804);
	c.moveTo(w * 0.0556, h * 0.3454);
	c.lineTo(w * 0.9556, h * 0.3454);
	c.moveTo(w * 0.05, h * 0.3143);
	c.lineTo(w * 0.95, h * 0.3143);
	c.moveTo(w * 0.0489, h * 0.2832);
	c.lineTo(w * 0.0489, h * 0.2832);
	c.moveTo(w * 0.0544, h * 0.254);
	c.lineTo(w * 0.9544, h * 0.254);
	c.moveTo(w * 0.0489, h * 0.221);
	c.lineTo(w * 0.9489, h * 0.221);
	c.moveTo(w * 0.0556, h * 0.1918);
	c.lineTo(w * 0.9556, h * 0.1918);
	c.moveTo(w * 0.0522, h * 0.1587);
	c.lineTo(w * 0.9522, h * 0.1587);
	c.moveTo(w * 0.0544, h * 0.1276);
	c.lineTo(w * 0.9544, h * 0.1276);
	c.moveTo(w * 0.0544, h * 0.0965);
	c.lineTo(w * 0.9544, h * 0.0965);
	c.moveTo(w * 0.0556, h * 0.0654);
	c.lineTo(w * 0.9556, h * 0.0654);
	c.moveTo(w * 0.0533, h * 0.0304);
	c.lineTo(w * 0.9533, h * 0.0304);
	c.moveTo(w * 0.0556, 0);
	c.lineTo(w * 0.9556, 0);
	c.stroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.orders', mxLeanOrders);

mxLeanOrders.prototype.constraints = [
                                         new mxConnectionConstraint(new mxPoint(0.05, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.95, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0, 1), true),
                                         new mxConnectionConstraint(new mxPoint(1, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 0), true),
                                         new mxConnectionConstraint(new mxPoint(0.05, 0.25), false),
                                         new mxConnectionConstraint(new mxPoint(0.05, 0.5), false),
                                         new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(0.95, 0.25), false),
                                         new mxConnectionConstraint(new mxPoint(0.95, 0.5), false),
                                         new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                         new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                         new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                         ];

//**********************************************************************************************************************************************************
//Batched Kanban
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanBatchedKanban(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanBatchedKanban, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanBatchedKanban.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(110, w);
	
	c.translate(x, y);
	
	c.begin();
	c.moveTo(4, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5 - 20, h * 0.5 - 35);
	c.lineTo(w * 0.5 + 25, h * 0.5 - 35);
	c.lineTo(w * 0.5 + 40, h * 0.5 - 20);
	c.lineTo(w * 0.5 + 40, h * 0.5 + 15);
	c.lineTo(w * 0.5 - 20, h * 0.5 + 15);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.5 - 30, h * 0.5 - 25);
	c.lineTo(w * 0.5 + 15, h * 0.5 - 25);
	c.lineTo(w * 0.5 + 30, h * 0.5 - 10);
	c.lineTo(w * 0.5 + 30, h * 0.5 + 25);
	c.lineTo(w * 0.5 - 30, h * 0.5 + 25);
	c.close();
	c.fillAndStroke();
	
	c.begin();
	c.moveTo(w * 0.5 - 40, h * 0.5 - 15);
	c.lineTo(w * 0.5 + 5, h * 0.5 - 15);
	c.lineTo(w * 0.5 + 20, h * 0.5);
	c.lineTo(w * 0.5 + 20, h * 0.5 + 35);
	c.lineTo(w * 0.5 - 40, h * 0.5 + 35);
	c.close();
	c.fillAndStroke();
	
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.begin();
	c.moveTo(w - 10, h * 0.5 - 4);
	c.lineTo(w, h * 0.5);
	c.lineTo(w - 10, h * 0.5 + 4);
	c.close();
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.batched_kanban', mxLeanBatchedKanban);

mxLeanBatchedKanban.prototype.constraints = [
                                      new mxConnectionConstraint(new mxPoint(0, 0.5), true),
                                      new mxConnectionConstraint(new mxPoint(1, 0.5), true)
                                      ];

//**********************************************************************************************************************************************************
//Control Center
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxLeanControlCenter(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxLeanControlCenter, mxShape);

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxLeanControlCenter.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.rect(w * 0.15, 0, w * 0.7, h * 0.8);
	c.fillAndStroke();
	c.rect(0, h * 0.8, w, h * 0.2);
	c.fillAndStroke();
};

mxCellRenderer.registerShape('mxgraph.lean_mapping.control_center', mxLeanControlCenter);

mxLeanControlCenter.prototype.constraints = [
                                      new mxConnectionConstraint(new mxPoint(0.15, 0), true),
                                      new mxConnectionConstraint(new mxPoint(0.85, 0), true),
                                      new mxConnectionConstraint(new mxPoint(0, 1), true),
                                      new mxConnectionConstraint(new mxPoint(1, 1), true),
                                      new mxConnectionConstraint(new mxPoint(0.5, 0), true),
                                      new mxConnectionConstraint(new mxPoint(0.15, 0.25), false),
                                      new mxConnectionConstraint(new mxPoint(0.15, 0.5), false),
                                      new mxConnectionConstraint(new mxPoint(0, 0.75), true),
                                      new mxConnectionConstraint(new mxPoint(0.85, 0.25), false),
                                      new mxConnectionConstraint(new mxPoint(0.85, 0.5), false),
                                      new mxConnectionConstraint(new mxPoint(1, 0.75), true),
                                      new mxConnectionConstraint(new mxPoint(0.25, 1), true),
                                      new mxConnectionConstraint(new mxPoint(0.5, 1), true),
                                      new mxConnectionConstraint(new mxPoint(0.75, 1), true)
                                      ];

//**********************************************************************************************************************************************************
//Electronical Info
//**********************************************************************************************************************************************************
function mxLeanElectronicInfoShape()
{
	mxArrow.call(this);
};

mxUtils.extend(mxLeanElectronicInfoShape, mxArrow);

mxLeanElectronicInfoShape.prototype.paintEdgeShape = function(c, pts)
{
	// Base vector (between end points)
	var p0 = pts[0];
	var pe = pts[pts.length - 1];
	
	var dx = pe.x - p0.x;
	var dy = pe.y - p0.y;
	
	p0.x = p0.x + dx * 0.05;
	p0.y = p0.y + dy * 0.05;
	pe.x = pe.x - dx * 0.05;
	pe.y = pe.y - dy * 0.05;
	dx = pe.x - p0.x;
	dy = pe.y - p0.y;
	
	var dist = Math.sqrt(dx * dx + dy * dy);
	var nx = dx / dist;
	var ny = dy / dist;
	var midX = p0.x + dx * 0.5; 
	var midY = p0.y + dy * 0.5;
	
	var p1x = midX - nx * dist * 0.1 - ny / 3 * dist * 0.1;
	var p1y = midY - ny * dist * 0.1 + nx / 3 * dist * 0.1;
	var p4x = midX + nx * dist * 0.1 + ny / 3 * dist * 0.1;
	var p4y = midY + ny * dist * 0.1 - nx / 3 * dist * 0.1;

	c.begin();
	c.moveTo(p0.x, p0.y);
	c.lineTo(p4x, p4y);
	c.lineTo(p1x, p1y);
	c.lineTo(pe.x, pe.y);
	c.stroke();

	var dx = pe.x - p1x;
	var dy = pe.y - p1y;
	var dist = Math.sqrt(dx * dx + dy * dy);
	var nx = dx / dist;
	var ny = dy / dist;
	
	c.setFillColor(mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000'));
	c.begin();
	c.moveTo(pe.x - nx * 10 - ny * 5, pe.y - ny * 10 + nx * 5);
	c.lineTo(pe.x, pe.y);
	c.lineTo(pe.x - nx * 10 + ny * 5, pe.y - ny * 10 - nx * 5);
	c.fillAndStroke();
};

// Registers the electronic info shape
mxCellRenderer.registerShape('mxgraph.lean_mapping.electronic_info_flow_edge', mxLeanElectronicInfoShape);

//**********************************************************************************************************************************************************
//Manual Info
//**********************************************************************************************************************************************************
function mxLeanManualInfoShape()
{
	mxArrow.call(this);
};

mxUtils.extend(mxLeanManualInfoShape, mxArrow);

mxLeanManualInfoShape.prototype.paintEdgeShape = function(c, pts)
{
	// Base vector (between end points)
	var p0 = pts[0];
	var pe = pts[pts.length - 1];
	
	var dx = pe.x - p0.x;
	var dy = pe.y - p0.y;
	
	p0.x = p0.x + dx * 0.05;
	p0.y = p0.y + dy * 0.05;
	pe.x = pe.x - dx * 0.05;
	pe.y = pe.y - dy * 0.05;
	dx = pe.x - p0.x;
	dy = pe.y - p0.y;
	
	var dist = Math.sqrt(dx * dx + dy * dy);
	var nx = dx / dist;
	var ny = dy / dist;
	
	c.begin();
	c.moveTo(p0.x, p0.y);
	c.lineTo(pe.x, pe.y);
	c.stroke();

	c.setFillColor(mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000'));
	c.begin();
	c.moveTo(pe.x - nx * 10 - ny * 5, pe.y - ny * 10 + nx * 5);
	c.lineTo(pe.x, pe.y);
	c.lineTo(pe.x - nx * 10 + ny * 5, pe.y - ny * 10 - nx * 5);
	c.fillAndStroke();
};

//Registers the electronic info shape
mxCellRenderer.registerShape('mxgraph.lean_mapping.manual_info_flow_edge', mxLeanManualInfoShape);

//**********************************************************************************************************************************************************
//Timeline
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeLeanTimeline(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeLeanTimeline, mxShape);

mxShapeLeanTimeline.prototype.cst = {
		SHAPE_TIMELINE : 'mxgraph.lean_mapping.timeline2'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeLeanTimeline.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var dy1 = mxUtils.getValue(this.style, 'dy1', '0');
	var dx2 = mxUtils.getValue(this.style, 'dx2', '0');
	var dy2 = mxUtils.getValue(this.style, 'dy2', '0');
	var dx3 = mxUtils.getValue(this.style, 'dx3', '0');
	var dy3 = mxUtils.getValue(this.style, 'dy3', '0');
	var dx4 = mxUtils.getValue(this.style, 'dx4', '0');
	var dy4 = mxUtils.getValue(this.style, 'dy4', '0');
	var dx5 = mxUtils.getValue(this.style, 'dx5', '0');
	var dy5 = mxUtils.getValue(this.style, 'dy5', '0');
	var dy6 = mxUtils.getValue(this.style, 'dy6', '0');
	
	var lastUp = true;

	c.begin();

	if (dy1 <= 0.5)
	{
		c.moveTo(0, 0);
		lastUp = true;
	}
	else
	{
		c.moveTo(0, h);
		lastUp = false;
	}

	//2
	if (dy2 <= 0.5 && lastUp)
	{
		c.lineTo(dx2, 0);
		lastUp = true;
	}
	else if (dy2 > 0.5 && !lastUp)
	{
		c.lineTo(dx2, h);
		lastUp = false;
	}
	else if (dy2 <= 0.5 && !lastUp)
	{
		c.lineTo(dx2, h);
		c.lineTo(dx2, 0);
		lastUp = true;
	}
	else
	{
		c.lineTo(dx2, 0);
		c.lineTo(dx2, h);
		lastUp = false;
	}
		
	//3
	if (dy3 <= 0.5 && lastUp)
	{
		c.lineTo(dx3, 0);
		lastUp = true;
	}
	else if (dy3 > 0.5 && !lastUp)
	{
		c.lineTo(dx3, h);
		lastUp = false;
	}
	else if (dy3 <= 0.5 && !lastUp)
	{
		c.lineTo(dx3, h);
		c.lineTo(dx3, 0);
		lastUp = true;
	}
	else
	{
		c.lineTo(dx3, 0);
		c.lineTo(dx3, h);
		lastUp = false;
	}
		
	//4
	if (dy4 <= 0.5 && lastUp)
	{
		c.lineTo(dx4, 0);
		lastUp = true;
	}
	else if (dy4 > 0.5 && !lastUp)
	{
		c.lineTo(dx4, h);
		lastUp = false;
	}
	else if (dy4 <= 0.5 && !lastUp)
	{
		c.lineTo(dx4, h);
		c.lineTo(dx4, 0);
		lastUp = true;
	}
	else
	{
		c.lineTo(dx4, 0);
		c.lineTo(dx4, h);
		lastUp = false;
	}
		
	//5
	if (dy5 <= 0.5 && lastUp)
	{
		c.lineTo(dx5, 0);
		lastUp = true;
	}
	else if (dy5 > 0.5 && !lastUp)
	{
		c.lineTo(dx5, h);
		lastUp = false;
	}
	else if (dy5 <= 0.5 && !lastUp)
	{
		c.lineTo(dx5, h);
		c.lineTo(dx5, 0);
		lastUp = true;
	}
	else
	{
		c.lineTo(dx5, 0);
		c.lineTo(dx5, h);
		lastUp = false;
	}
		
	//6
	if (dy6 <= 0.5 && lastUp)
	{
		c.lineTo(w, 0);
		lastUp = true;
	}
	else if (dy6 > 0.5 && !lastUp)
	{
		c.lineTo(w, h);
		lastUp = false;
	}
	else if (dy6 <= 0.5 && !lastUp)
	{
		c.lineTo(w, h);
		c.lineTo(w, 0);
		lastUp = true;
	}
	else
	{
		c.lineTo(w, 0);
		c.lineTo(w, h);
		lastUp = false;
	}
		
	//end
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeLeanTimeline.prototype.cst.SHAPE_TIMELINE, mxShapeLeanTimeline);

Graph.handleFactory[mxShapeLeanTimeline.prototype.cst.SHAPE_TIMELINE] = function(state)
{
	var handles = [Graph.createHandle(state, ['dy1'], function(bounds)
			{
				var dy1 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy1', 0))));

				return new mxPoint(bounds.x, bounds.y + dy1 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dy1'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			})];

	var handle2 = Graph.createHandle(state, ['dx2', 'dy2'], function(bounds)
			{

				var dx2 = Math.max(0, Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx3', 0)), parseFloat(mxUtils.getValue(this.state.style, 'dx2', 0))));
				var dy2 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy2', 0))));

				return new mxPoint(bounds.x + dx2, bounds.y + dy2 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dx2'] = Math.round(1000 * Math.max(0, Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx3', 0)), (pt.x - bounds.x)))) / 1000;
				this.state.style['dy2'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			});
	
	handles.push(handle2);

	var handle3 = Graph.createHandle(state, ['dx3', 'dy3'], function(bounds)
			{
				var dx3 = Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx2', 0)), Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx4', 0)), parseFloat(mxUtils.getValue(this.state.style, 'dx3', 0))));
				var dy3 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy3', 0))));

				return new mxPoint(bounds.x + dx3, bounds.y + dy3 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dx3'] = Math.round(1000 * Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx2', 0)), Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx4', 0)), (pt.x - bounds.x)))) / 1000;
				this.state.style['dy3'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			});
	
	handles.push(handle3);

	var handle4 = Graph.createHandle(state, ['dx4', 'dy4'], function(bounds)
			{
				var dx4 = Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx3', 0)), Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx5', 0)), parseFloat(mxUtils.getValue(this.state.style, 'dx4', 0))));
				var dy4 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy4', 0))));

				return new mxPoint(bounds.x + dx4, bounds.y + dy4 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dx4'] = Math.round(1000 * Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx3', 0)), Math.min(parseFloat(mxUtils.getValue(this.state.style, 'dx5', 0)), (pt.x - bounds.x)))) / 1000;
				this.state.style['dy4'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			});
	
	handles.push(handle4);

	var handle5 = Graph.createHandle(state, ['dx5', 'dy5'], function(bounds)
			{
				var dx5 = Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx4', 0)), Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'dx5', 0))));
				var dy5 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy5', 0))));

				return new mxPoint(bounds.x + dx5, bounds.y + dy5 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dx5'] = Math.round(1000 * Math.max(parseFloat(mxUtils.getValue(this.state.style, 'dx4', 0)), Math.min(bounds.width, (pt.x - bounds.x)))) / 1000;
				this.state.style['dy5'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			});
	
	handles.push(handle5);

	var handle6 = Graph.createHandle(state, ['dy6'], function(bounds)
			{
				var dy6 = Math.max(0, Math.min(100, parseFloat(mxUtils.getValue(this.state.style, 'dy6', 0))));

				return new mxPoint(bounds.x + bounds.width, bounds.y + dy6 * bounds.height);
			}, function(bounds, pt)
			{
				this.state.style['dy6'] = Math.round(1000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 1000;
			});

	handles.push(handle6);

	return handles;
};
