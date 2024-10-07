/**
 * $Id: mxFlowchart.js,v 1.5 2016/04/1 12:32:06 mate Exp $
 * Copyright (c) 2006-2018, JGraph Ltd
 */
//**********************************************************************************************************************************************************
// Document 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeFlowchartDocument2(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
	this.fill = fill;
	this.stroke = stroke;
	this.strokewidth = (strokewidth != null) ? strokewidth : 1;
	this.size = 0.5;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeFlowchartDocument2, mxActor);

mxShapeFlowchartDocument2.prototype.cst = {DOCUMENT2 : 'mxgraph.flowchart.document2'};

mxShapeFlowchartDocument2.prototype.customProperties = [
	{name: 'size', dispName: 'Wave Size', type: 'float', min:0, max:1, defVal:0.25},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeFlowchartDocument2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var dy = h * Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.style, 'size', this.size))));
	var fy = 1.4;
	var r = 5;
	
	c.begin();
	c.moveTo(w - r, 0);
	c.arcTo(r, r, 0, 0, 1, w, r);
	c.lineTo(w, h - dy / 2);
	c.quadTo(w * 3 / 4, h - dy * fy, w / 2, h - dy / 2);
	c.quadTo(w / 4, h - dy * (1 - fy), 0, h - dy / 2);
	c.lineTo(0, dy / 2);
	c.lineTo(0, r);
	c.arcTo(r, r, 0, 0, 1, r, 0);
	c.close();
	c.fillAndStroke();

};

mxCellRenderer.registerShape(mxShapeFlowchartDocument2.prototype.cst.DOCUMENT2, mxShapeFlowchartDocument2);

mxShapeFlowchartDocument2.prototype.constraints = null;

Graph.handleFactory[mxShapeFlowchartDocument2.prototype.cst.DOCUMENT2] = function(state)
{
	var handles = [Graph.createHandle(state, ['size'], function(bounds)
	{
		var size = Math.max(0, Math.min(1, parseFloat(mxUtils.getValue(this.state.style, 'size', this.size))));

		return new mxPoint(bounds.x + 3 * bounds.width / 4, bounds.y + (1 - size) * bounds.height);

	}, function(bounds, pt)
	{
		this.state.style['size'] = Math.max(0, Math.min(1, (bounds.y + bounds.height - pt.y) / bounds.height));
	})];
			
	return handles;
};
