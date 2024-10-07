/**
 * $Id: mxMockupiOS.js,v 1.5 2013/11/12 06:25:46 mate Exp $
 * Copyright (c) 2006-2010, JGraph Ltd
 */

var mxMockupC =
{
		BAR_HEIGHT : 'barHeight',
		BAR_POS : 'barPos',
		BG_STYLE : 'bgStyle',
		BG_FLAT_GREEN : 'bgGreen',
		BG_FLAT_WHITE : 'bgWhite',
		BG_FLAT_GRAY : 'bgGray',
		BG_FLAT_CUSTOM : 'bgFlat',
		BG_MAP : 'bgMap',
		BG_STRIPED : 'bgStriped',
		BUTTON_STYLE : 'buttonStyle',
		BUTTON_TEXT : 'buttonText',
		BUTTON_STATE : 'buttonState',
		CHEVRON : 'chevron',
		GRID_SIZE : 'gridSize',
		POINTER_BOTTOM : 'bottom',
		POINTER_POS : 'pointerPos',
		POINTER_TOP : 'top',
		ROUND : 'round',
		SELECTED : '+', 		//has to be one character long
		STATE_ON : 'on',
		STATE_OFF : 'off',
		SUB_TEXT : 'subText',
		
		SHAPE_IADD_ICON : 'mxgraph.ios.iAddIcon',
		SHAPE_IALERT_BOX : 'mxgraph.ios.iAlertBox',
		SHAPE_IALPHA_LIST : 'mxgraph.ios.iAlphaList',
		SHAPE_IAPP_BAR : 'mxgraph.ios.iAppBar',
		SHAPE_IARROW_ICON : 'mxgraph.ios.iArrowIcon',
		SHAPE_IBG_FLAT : 'mxgraph.ios.iBgFlat',
		SHAPE_IBG_MAP : 'mxgraph.ios.iBgMap',
		SHAPE_IBG_STRIPED : 'mxgraph.ios.iBgStriped',
		SHAPE_IBUTTON : 'mxgraph.ios.iButton',
		SHAPE_IBUTTON_BACK : 'mxgraph.ios.iButtonBack',
		SHAPE_IBUTTON_FORWARD : 'mxgraph.ios.iButtonFw',
		SHAPE_IBUTTON_BAR : 'mxgraph.ios.iButtonBar',
		SHAPE_ICALL_BUTTONS : 'mxgraph.ios.iCallButtons',
		SHAPE_ICALL_DIALOG : 'mxgraph.ios.iCallDialog',
		SHAPE_ICHECKBOX_GROUP : 'mxgraph.ios.iCheckboxGroup',
		SHAPE_ICHECK_ICON : 'mxgraph.ios.iCheckIcon',
		SHAPE_ICLOUD_PROGRESS_BAR : 'mxgraph.ios.iCloudProgressBar',
		SHAPE_ICOMBO_BOX : 'mxgraph.ios.iComboBox',
		SHAPE_ICOPY : 'mxgraph.ios.iCopy',
		SHAPE_ICOPY_AREA : 'mxgraph.ios.iCopyArea',
		SHAPE_IICON_GRID : 'mxgraph.ios.iIconGrid',
		SHAPE_IDELETE_APP : 'mxgraph.ios.iDeleteApp',
		SHAPE_IDELETE_ICON : 'mxgraph.ios.iDeleteIcon',
		SHAPE_IDOWNLOAD_BAR : 'mxgraph.ios.iDownloadBar',
		SHAPE_IDIALOG_BOX : 'mxgraph.ios.iDialogBox',
		SHAPE_IDIRECTION : 'mxgraph.ios.iDir',
		SHAPE_IHOME_PAGE_CONTROL : 'mxgraph.ios.iHomePageControl',
		SHAPE_IKEYB_LETTERS : 'mxgraph.ios.iKeybLett',
		SHAPE_IKEYB_NUMBERS : 'mxgraph.ios.iKeybNumb',
		SHAPE_IKEYB_SYMBOLS : 'mxgraph.ios.iKeybSymb',
		SHAPE_ILOCATION_BAR : 'mxgraph.ios.iLocBar',
		SHAPE_ILOCK_BUTTON : 'mxgraph.ios.iLockButton',
		SHAPE_IHOR_BUTTON_BAR : 'mxgraph.ios.iHorButtonBar',
		SHAPE_IINFO_ICON : 'mxgraph.ios.iInfoIcon',
		SHAPE_ION_OFF_BUTTON : 'mxgraph.ios.iOnOffButton',
		SHAPE_IOPTION : 'mxgraph.ios.iOption',
		SHAPE_IPAGE_CONTROL : 'mxgraph.ios.iPageControl',
		SHAPE_IPAD : 'mxgraph.ios.iPad',
		SHAPE_IPHONE : 'mxgraph.ios.iPhone',
		SHAPE_IPIN : 'mxgraph.ios.iPin',
		SHAPE_IPREV_NEXT : 'mxgraph.ios.iPrevNext',
		SHAPE_IPROGRESS_BAR : 'mxgraph.ios.iProgressBar',
		SHAPE_IRADIO_GROUP : 'mxgraph.ios.iRadioGroup',
		SHAPE_ISLIDER : 'mxgraph.ios.iSlider',
		SHAPE_ISORT_FIND_ICON : 'mxgraph.ios.iSortFindIcon',
		SHAPE_ITEXT_INPUT : 'mxgraph.ios.iTextInput',
		SHAPE_ITOP_BAR : 'mxgraph.ios.iTopBar',
		SHAPE_ITOP_BAR_LOCKED : 'mxgraph.ios.iTopBarLocked',
		SHAPE_IURL_BAR : 'mxgraph.ios.iURLBar',
		SHAPE_IVIDEO_CONTROLS : 'mxgraph.ios.iVideoControls',
		SHAPE_ISCREEN_NAME_BAR: 'mxgraph.ios.iScreenNameBar',
			
		STYLE_FILLCOLOR2 : 'fillColor2',
		STYLE_FILLCOLOR3 : 'fillColor3',
		STYLE_TEXTCOLOR : 'textColor',
		STYLE_TEXTCOLOR2 : 'textColor2',
		STYLE_STROKECOLOR2 : 'strokeColor2',
		STYLE_STROKECOLOR3 : 'strokeColor3'
};

//**********************************************************************************************************************************************************
//iPhone Vertical
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiPhone(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiPhone, mxShape);

mxShapeMockupiPhone.prototype.customProperties = [
	{name: 'bgStyle', dispName: 'Background', type: 'enum', 
		enumList: [{val: 'bgGreen', dispName: 'Green'}, 
			       {val: 'bgWhite', dispName: 'White'}, 
			       {val: 'bgGray', dispName: 'Gray'}, 
			       {val: 'bgFlat', dispName: 'Flat'}, 
			       {val: 'bgMap', dispName: 'Map'}, 
			       {val: 'bgStriped', dispName: 'Striped'}]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiPhone.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = 25;
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeMockupiPhone.prototype.background = function(c, x, y, w, h, rSize)
{
	c.setFillColor('#000000');
	c.setStrokeColor('#000000');
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
};

mxShapeMockupiPhone.prototype.foreground = function(c, x, y, w, h, rSize)
{
	c.setStrokeWidth(1.5);

	c.begin();
	c.setGradient('#808080', '#000000', w * 0.325, 0, w * 0.675, h * 0.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.moveTo(w * 0.325, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.7, h * 0.5);
	c.close();
	c.fill();

	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '');
	var bgStyle = mxUtils.getValue(this.style, mxMockupC.BG_STYLE, mxMockupC.BG_FLAT_GREEN);

	c.setStrokeWidth(1);
	if (bgStyle === mxMockupC.BG_FLAT_WHITE)
	{
		c.setFillColor('#ffffff');
		c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_GREEN)
	{
		c.setFillColor('#1f2923');
		c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_GRAY)
	{
		c.setFillColor('#dddddd');
		c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_CUSTOM)
	{
		c.setFillColor(fillColor);
		c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_STRIPED)
	{
		var xOld = x;
		var yOld = y;
		var wOld = w;
		var hOld = h;
		c.translate(w * 0.0625, h * 0.15);
		w = w * 0.875;
		h = h * 0.7;

		c.setFillColor('#5D7585');
		c.rect(0, 0, w, h);
		c.fillAndStroke();

		var strokeColor = '#18211b';
		var strokeColor2 = '#657E8F';

		c.setStrokeColor(strokeColor2);
		var i = 5;
		c.begin();

		while (i < w)
		{
			c.moveTo(i, 0);
			c.lineTo(i, h);
			i = i + 5;
		}

		c.stroke();

		c.setStrokeColor(strokeColor);
		c.begin();
		c.rect(0, 0, w, h);
		c.stroke();

		w = wOld;
		h = hOld;
		c.translate( - w * 0.0625, - h * 0.15);
	}
	else if (bgStyle === mxMockupC.BG_MAP)
	{
		var xOld = x;
		var yOld = y;
		var wOld = w;
		var hOld = h;
		c.translate(w * 0.0625, h * 0.15);
		w = w * 0.875;
		h = h * 0.7;

		c.setFillColor('#ffffff');
		c.rect(0, 0, w, h);
		c.fillAndStroke();

		var fillColor2 = '#96D1FF';
		var strokeColor = '#18211b';
		var strokeColor2 = '#008cff';

		c.setFillColor(fillColor2);
		c.setStrokeColor(strokeColor2);
		c.setStrokeWidth(1);

		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w * 0.1171, 0);
		c.lineTo(w * 0.1136, h * 0.0438);
		c.lineTo(w * 0.0993, h * 0.054);
		c.lineTo(0, h * 0.0446);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1993, 0);
		c.lineTo(w * 0.1914, h * 0.03884);
		c.lineTo(w * 0.1536, h * 0.0362);
		c.lineTo(w * 0.1586, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.24, 0);
		c.lineTo(w * 0.2257, h * 0.054);
		c.lineTo(w * 0.2414, h * 0.0674);
		c.lineTo(w * 0.4707, h * 0.0835);
		c.lineTo(w * 0.5264, h * 0.0906);
		c.lineTo(w * 0.6429, h * 0.0929);
		c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.7193, h * 0.0621);
		c.arcTo(w * 0.48, h * 0.2143, 0, 0, 0, w * 0.7286, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8, 0);
		c.lineTo(w * 0.7886, h * 0.04554);
		c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.8164, h * 0.0875);
		c.arcTo(w * 0.1429, h * 0.0893, 0, 0, 0, w * 0.88, h * 0.1036);
		c.lineTo(w, h * 0.1112);
		c.lineTo(w, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.0933);
		c.lineTo(w * 0.08, h * 0.1036);
		c.lineTo(w * 0.1021, h * 0.1246);
		c.lineTo(w * 0.1007, h * 0.1768);
		c.lineTo(w * 0.0471, h * 0.2241);
		c.lineTo(0, h * 0.2527);
		c.close();
		c.fillAndStroke();

		c.ellipse(w * 0.1214, h * 0.0603, w * 0.0843, h * 0.0576);
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1293, h * 0.1924);
		c.lineTo(w * 0.1729, h * 0.142);
		c.lineTo(w * 0.1407, h * 0.1411);
		c.lineTo(w * 0.14, h * 0.1777);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4586, h * 0.1241);
		c.lineTo(w * 0.455, h * 0.1835);
		c.lineTo(w * 0.3893, h * 0.2246);
		c.lineTo(w * 0.2171, h * 0.1362);
		c.lineTo(w * 0.2171, h * 0.1308);
		c.lineTo(w * 0.2293, h * 0.1214);
		c.lineTo(w * 0.2857, h * 0.1174);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5079, h * 0.1134);
		c.lineTo(w * 0.7307, h * 0.1223);
		c.lineTo(w * 0.7279, h * 0.1625);
		c.lineTo(w * 0.715, h * 0.1772);
		c.lineTo(w * 0.6929, h * 0.1688);
		c.lineTo(w * 0.625, h * 0.1795);
		c.lineTo(w * 0.4779, h * 0.2835);
		c.lineTo(w * 0.395, h * 0.2299);
		c.lineTo(w * 0.4657, h * 0.1826);
		c.lineTo(w * 0.4707, h * 0.1223);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.1362);
		c.lineTo(w * 0.7643, h * 0.1237);
		c.lineTo(w * 0.7543, h * 0.1562);
		c.lineTo(w * 0.7643, h * 0.1585);
		c.lineTo(w * 0.9186, h * 0.2366);
		c.lineTo(w, h * 0.1732);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2079, h * 0.1545);
		c.lineTo(w * 0.3886, h * 0.2536);
		c.lineTo(w * 0.3414, h * 0.2933);
		c.lineTo(w * 0.1743, h * 0.1969);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1579, h * 0.2134);
		c.lineTo(w * 0.3221, h * 0.3067);
		c.lineTo(w * 0.2957, h * 0.3237);
		c.lineTo(w * 0.1157, h * 0.2424);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.405, h * 0.2656);
		c.lineTo(w * 0.31, h * 0.3353);
		c.lineTo(w * 0.3693, h * 0.3661);
		c.lineTo(w * 0.4571, h * 0.2982);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.7121, h * 0.1848);
		c.lineTo(w * 0.6879, h * 0.1754);
		c.lineTo(w * 0.6329, h * 0.1844);
		c.lineTo(w * 0.61, h * 0.2018);
		c.lineTo(w * 0.6207, h * 0.2085);
		c.lineTo(w * 0.4986, h * 0.2982);
		c.lineTo(w * 0.535, h * 0.3237);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5557, h * 0.3379);
		c.lineTo(w * 0.7464, h * 0.1826);
		c.lineTo(w * 0.8036, h * 0.2076);
		c.lineTo(w * 0.595, h * 0.3616);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8293, h * 0.2188);
		c.lineTo(w * 0.8979, h * 0.2509);
		c.lineTo(w * 0.6936, h * 0.4125);
		c.lineTo(w * 0.6171, h * 0.3737);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.2138);
		c.lineTo(w * 0.6821, h * 0.4603);
		c.lineTo(w * 0.815, h * 0.5277);
		c.lineTo(w, h * 0.4);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.317);
		c.lineTo(w * 0.0971, h * 0.2554);
		c.lineTo(w * 0.4121, h * 0.4143);
		c.lineTo(w * 0.3736, h * 0.4415);
		c.lineTo(w * 0.315, h * 0.4076);
		c.lineTo(w * 0.3093, h * 0.4116);
		c.lineTo(w * 0.3686, h * 0.4455);
		c.lineTo(w * 0.285, h * 0.5045);
		c.lineTo(w * 0.1114, h * 0.4134);
		c.lineTo(w * 0.025, h * 0.4603);
		c.lineTo(w * 0.0371, h * 0.4723);
		c.lineTo(w * 0.1114, h * 0.4371);
		c.lineTo(w * 0.2871, h * 0.5312);
		c.lineTo(w * 0.1929, h * 0.6058);
		c.lineTo(w * 0.2271, h * 0.6705);
		c.lineTo(w * 0.17, h * 0.7147);
		c.lineTo(w * 0.0314, h * 0.6321);
		c.lineTo(0, h * 0.6246);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.48, h * 0.3121);
		c.lineTo(w * 0.5157, h * 0.3375);
		c.lineTo(w * 0.4314, h * 0.3982);
		c.lineTo(w * 0.3929, h * 0.3786);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3086, h * 0.5179);
		c.lineTo(w * 0.53, h * 0.3518);
		c.lineTo(w * 0.5757, h * 0.3745);
		c.lineTo(w * 0.3479, h * 0.5411);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5964, h * 0.3884);
		c.lineTo(w * 0.6736, h * 0.4277);
		c.lineTo(w * 0.445, h * 0.5991);
		c.lineTo(w * 0.3664, h * 0.5531);
		c.lineTo(w * 0.5057, h * 0.4545);
		c.lineTo(w * 0.5507, h * 0.4754);
		c.lineTo(w * 0.5571, h * 0.4723);
		c.lineTo(w * 0.5114, h * 0.4504);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4793, h * 0.6161);
		c.lineTo(w * 0.6771, h * 0.4643);
		c.lineTo(w * 0.8086, h * 0.5326);
		c.lineTo(w * 0.7471, h * 0.5817);
		c.lineTo(w * 0.7214, h * 0.567);
		c.lineTo(w * 0.715, h * 0.571);
		c.lineTo(w * 0.7421, h * 0.5871);
		c.lineTo(w * 0.6014, h * 0.6933);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.4371);
		c.lineTo(w * 0.8443, h * 0.546);
		c.lineTo(w * 0.9071, h * 0.5701);
		c.lineTo(w, h * 0.5022);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8407, h * 0.5504);
		c.lineTo(w * 0.8993, h * 0.5759);
		c.lineTo(w * 0.6757, h * 0.7416);
		c.lineTo(w * 0.6286, h * 0.7139);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.5321);
		c.lineTo(w * 0.6979, h * 0.7549);
		c.lineTo(w * 0.7457, h * 0.7781);
		c.lineTo(w * 0.9814, h * 0.6094);
		c.lineTo(w, h * 0.6067);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.6254);
		c.lineTo(w * 0.7664, h * 0.792);
		c.lineTo(w * 0.9586, h * 0.9062);
		c.lineTo(w, h * 0.8786);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3093, h * 0.5464);
		c.lineTo(w * 0.4271, h * 0.6152);
		c.lineTo(w * 0.245, h * 0.7643);
		c.lineTo(w * 0.185, h * 0.7228);
		c.lineTo(w * 0.2493, h * 0.6728);
		c.lineTo(w * 0.2214, h * 0.6143);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.65);
		c.lineTo(w * 0.2179, h * 0.7826);
		c.lineTo(w * 0.1136, h * 0.8424);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.7272);
		c.lineTo(w * 0.0821, h * 0.859);
		c.lineTo(0, h * 0.9085);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4529, h * 0.6366);
		c.lineTo(w * 0.575, h * 0.7143);
		c.lineTo(w * 0.39, h * 0.8621);
		c.lineTo(w * 0.2657, h * 0.7902);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.9415);
		c.lineTo(w * 0.1036, h * 0.8821);
		c.lineTo(w * 0.2343, h * 0.959);
		c.lineTo(w * 0.1721, h);
		c.lineTo(0, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2586, h * 0.7951);
		c.lineTo(w * 0.3829, h * 0.8674);
		c.lineTo(w * 0.2543, h * 0.9451);
		c.lineTo(w * 0.1279, h * 0.8692);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2836, h * 0.9639);
		c.lineTo(w * 0.4207, h * 0.8772);
		c.lineTo(w * 0.605, h * 0.7321);
		c.lineTo(w * 0.6521, h * 0.7634);
		c.lineTo(w * 0.3486, h);
		c.lineTo(w * 0.3393, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3879, h);
		c.lineTo(w * 0.6721, h * 0.7759);
		c.lineTo(w * 0.7171, h * 0.7982);
		c.lineTo(w * 0.4564, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4986, h);
		c.lineTo(w * 0.7386, h * 0.8125);
		c.lineTo(w * 0.9307, h * 0.925);
		c.lineTo(w * 0.8264, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8671, h);
		c.lineTo(w * 0.9464, h * 0.9491);
		c.lineTo(w, h * 0.975);
		c.lineTo(w, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2295, h);
		c.lineTo(w * 0.2648, h * 0.9792);
		c.lineTo(w * 0.2981, h);
		c.close();
		c.fillAndStroke();

		w = wOld;
		h = hOld;
		c.translate( - w * 0.0625, - h * 0.15);
	}

	c.setStrokeWidth(1);
	c.setStrokeColor('#18211b');
	c.rect(w * 0.0625, h * 0.15, w * 0.875, h * 0.7);
	c.stroke();

	c.setStrokeWidth(1.5);
	c.setAlpha(0.8);
	c.setStrokeColor('#dddddd');
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.stroke();

	rSize = 22.5;
	c.begin();
	c.setStrokeColor('#666666');
	c.roundrect(5, 5, w - 10, h - 10, rSize, rSize);
	c.stroke();

	c.setAlpha(1);
	c.ellipse(w * 0.4875, h * 0.04125, w * 0.025, h * 0.0125);
	c.setStrokeWidth(2.5);
	c.setStrokeColor('#000000');
	c.setFillColor('#000099');
	c.fillAndStroke();

	c.begin();
	c.setStrokeWidth(1.5);
	c.setFillColor('#444444');
	c.setStrokeColor('#333333');
	rSize = 4;

	c.roundrect(w * 0.375, h * 0.075, w * 0.25, h * 0.01875, w * 0.02, h * 0.01);
	c.fillAndStroke();

	c.setGradient('#bbbbbb', '#000000', w * 0.4, h * 0.875, w * 0.2, h * 0.1, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.ellipse(w * 0.4, h * 0.875, w * 0.2, h * 0.1);
	c.fill();

	c.setAlpha(0.5);
	c.ellipse(w * 0.404, h * 0.876, w * 0.19, h * 0.095);
	c.stroke();

	c.begin();
	c.setAlpha(0.85);
	c.setFillColor('#000000');
	c.moveTo(w * 0.4025, h * 0.925);
	c.arcTo(w * 0.0975, h * 0.04625, 0, 0, 1, w * 0.5975, h * 0.925);
	c.arcTo(w * 0.2, h * 0.1, 0, 0, 1, w * 0.4025, h * 0.925);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.setAlpha(0.7);
	c.setStrokeWidth(1.5);
	c.setStrokeColor('#dddddd');
	rSize = 4;
	c.roundrect(w * 0.4575, h * 0.905, w * 0.0875, h * 0.04375, h * 0.00625, h * 0.00625);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPHONE, mxShapeMockupiPhone);

//**********************************************************************************************************************************************************
//iPhone flat colored background
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiBgFlat(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiBgFlat, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiBgFlat.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
};

mxShapeMockupiBgFlat.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBG_FLAT, mxShapeMockupiBgFlat);

//**********************************************************************************************************************************************************
//iPhone striped background
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiBgStriped(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiBgStriped, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiBgStriped.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiBgStriped.prototype.background = function(c, x, y, w, h)
{
	c.setStrokeWidth(1);
	c.begin();
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiBgStriped.prototype.foreground = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '');
	var strokeColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_STROKECOLOR2, '');

	c.setStrokeColor(strokeColor2);
	var i = 5;
	c.begin();

	while (i < w)
	{
		c.moveTo(i, 0);
		c.lineTo(i, h);
		i = i + 5;
	}

	c.stroke();

	c.setStrokeColor(strokeColor);
	c.begin();
	c.rect(0, 0, w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBG_STRIPED, mxShapeMockupiBgStriped);

//**********************************************************************************************************************************************************
//iPhone map background
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiBgMap(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiBgMap, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiBgMap.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiBgMap.prototype.background = function(c, x, y, w, h)
{
	c.begin();
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiBgMap.prototype.foreground = function(c, x, y, w, h)
{
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '');
	var strokeColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_STROKECOLOR2, '');

	c.setFillColor(fillColor2);
	c.setStrokeColor(strokeColor2);
	c.setStrokeWidth(0.5);

	c.begin();
	c.moveTo(0, 0);
	c.lineTo(w * 0.1171, 0);
	c.lineTo(w * 0.1136, h * 0.0438);
	c.lineTo(w * 0.0993, h * 0.054);
	c.lineTo(0, h * 0.0446);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.1993, 0);
	c.lineTo(w * 0.1914, h * 0.03884);
	c.lineTo(w * 0.1536, h * 0.0362);
	c.lineTo(w * 0.1586, 0);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.24, 0);
	c.lineTo(w * 0.2257, h * 0.054);
	c.lineTo(w * 0.2414, h * 0.0674);
	c.lineTo(w * 0.4707, h * 0.0835);
	c.lineTo(w * 0.5264, h * 0.0906);
	c.lineTo(w * 0.6429, h * 0.0929);
	c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.7193, h * 0.0621);
	c.arcTo(w * 0.48, h * 0.2143, 0, 0, 0, w * 0.7286, 0);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8, 0);
	c.lineTo(w * 0.7886, h * 0.04554);
	c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.8164, h * 0.0875);
	c.arcTo(w * 0.1429, h * 0.0893, 0, 0, 0, w * 0.88, h * 0.1036);
	c.lineTo(w, h * 0.1112);
	c.lineTo(w, 0);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(0, h * 0.0933);
	c.lineTo(w * 0.08, h * 0.1036);
	c.lineTo(w * 0.1021, h * 0.1246);
	c.lineTo(w * 0.1007, h * 0.1768);
	c.lineTo(w * 0.0471, h * 0.2241);
	c.lineTo(0, h * 0.2527);
	c.close();
	c.fillAndStroke();

	c.ellipse(w * 0.1214, h * 0.0603, w * 0.0843, h * 0.0576);
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.1293, h * 0.1924);
	c.lineTo(w * 0.1729, h * 0.142);
	c.lineTo(w * 0.1407, h * 0.1411);
	c.lineTo(w * 0.14, h * 0.1777);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.4586, h * 0.1241);
	c.lineTo(w * 0.455, h * 0.1835);
	c.lineTo(w * 0.3893, h * 0.2246);
	c.lineTo(w * 0.2171, h * 0.1362);
	c.lineTo(w * 0.2171, h * 0.1308);
	c.lineTo(w * 0.2293, h * 0.1214);
	c.lineTo(w * 0.2857, h * 0.1174);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5079, h * 0.1134);
	c.lineTo(w * 0.7307, h * 0.1223);
	c.lineTo(w * 0.7279, h * 0.1625);
	c.lineTo(w * 0.715, h * 0.1772);
	c.lineTo(w * 0.6929, h * 0.1688);
	c.lineTo(w * 0.625, h * 0.1795);
	c.lineTo(w * 0.4779, h * 0.2835);
	c.lineTo(w * 0.395, h * 0.2299);
	c.lineTo(w * 0.4657, h * 0.1826);
	c.lineTo(w * 0.4707, h * 0.1223);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w, h * 0.1362);
	c.lineTo(w * 0.7643, h * 0.1237);
	c.lineTo(w * 0.7543, h * 0.1562);
	c.lineTo(w * 0.7643, h * 0.1585);
	c.lineTo(w * 0.9186, h * 0.2366);
	c.lineTo(w, h * 0.1732);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.2079, h * 0.1545);
	c.lineTo(w * 0.3886, h * 0.2536);
	c.lineTo(w * 0.3414, h * 0.2933);
	c.lineTo(w * 0.1743, h * 0.1969);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.1579, h * 0.2134);
	c.lineTo(w * 0.3221, h * 0.3067);
	c.lineTo(w * 0.2957, h * 0.3237);
	c.lineTo(w * 0.1157, h * 0.2424);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.405, h * 0.2656);
	c.lineTo(w * 0.31, h * 0.3353);
	c.lineTo(w * 0.3693, h * 0.3661);
	c.lineTo(w * 0.4571, h * 0.2982);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.7121, h * 0.1848);
	c.lineTo(w * 0.6879, h * 0.1754);
	c.lineTo(w * 0.6329, h * 0.1844);
	c.lineTo(w * 0.61, h * 0.2018);
	c.lineTo(w * 0.6207, h * 0.2085);
	c.lineTo(w * 0.4986, h * 0.2982);
	c.lineTo(w * 0.535, h * 0.3237);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5557, h * 0.3379);
	c.lineTo(w * 0.7464, h * 0.1826);
	c.lineTo(w * 0.8036, h * 0.2076);
	c.lineTo(w * 0.595, h * 0.3616);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8293, h * 0.2188);
	c.lineTo(w * 0.8979, h * 0.2509);
	c.lineTo(w * 0.6936, h * 0.4125);
	c.lineTo(w * 0.6171, h * 0.3737);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w, h * 0.2138);
	c.lineTo(w * 0.6821, h * 0.4603);
	c.lineTo(w * 0.815, h * 0.5277);
	c.lineTo(w, h * 0.4);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(0, h * 0.317);
	c.lineTo(w * 0.0971, h * 0.2554);
	c.lineTo(w * 0.4121, h * 0.4143);
	c.lineTo(w * 0.3736, h * 0.4415);
	c.lineTo(w * 0.315, h * 0.4076);
	c.lineTo(w * 0.3093, h * 0.4116);
	c.lineTo(w * 0.3686, h * 0.4455);
	c.lineTo(w * 0.285, h * 0.5045);
	c.lineTo(w * 0.1114, h * 0.4134);
	c.lineTo(w * 0.025, h * 0.4603);
	c.lineTo(w * 0.0371, h * 0.4723);
	c.lineTo(w * 0.1114, h * 0.4371);
	c.lineTo(w * 0.2871, h * 0.5312);
	c.lineTo(w * 0.1929, h * 0.6058);
	c.lineTo(w * 0.2271, h * 0.6705);
	c.lineTo(w * 0.17, h * 0.7147);
	c.lineTo(w * 0.0314, h * 0.6321);
	c.lineTo(0, h * 0.6246);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.48, h * 0.3121);
	c.lineTo(w * 0.5157, h * 0.3375);
	c.lineTo(w * 0.4314, h * 0.3982);
	c.lineTo(w * 0.3929, h * 0.3786);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.3086, h * 0.5179);
	c.lineTo(w * 0.53, h * 0.3518);
	c.lineTo(w * 0.5757, h * 0.3745);
	c.lineTo(w * 0.3479, h * 0.5411);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.5964, h * 0.3884);
	c.lineTo(w * 0.6736, h * 0.4277);
	c.lineTo(w * 0.445, h * 0.5991);
	c.lineTo(w * 0.3664, h * 0.5531);
	c.lineTo(w * 0.5057, h * 0.4545);
	c.lineTo(w * 0.5507, h * 0.4754);
	c.lineTo(w * 0.5571, h * 0.4723);
	c.lineTo(w * 0.5114, h * 0.4504);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.4793, h * 0.6161);
	c.lineTo(w * 0.6771, h * 0.4643);
	c.lineTo(w * 0.8086, h * 0.5326);
	c.lineTo(w * 0.7471, h * 0.5817);
	c.lineTo(w * 0.7214, h * 0.567);
	c.lineTo(w * 0.715, h * 0.571);
	c.lineTo(w * 0.7421, h * 0.5871);
	c.lineTo(w * 0.6014, h * 0.6933);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w, h * 0.4371);
	c.lineTo(w * 0.8443, h * 0.546);
	c.lineTo(w * 0.9071, h * 0.5701);
	c.lineTo(w, h * 0.5022);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8407, h * 0.5504);
	c.lineTo(w * 0.8993, h * 0.5759);
	c.lineTo(w * 0.6757, h * 0.7416);
	c.lineTo(w * 0.6286, h * 0.7139);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w, h * 0.5321);
	c.lineTo(w * 0.6979, h * 0.7549);
	c.lineTo(w * 0.7457, h * 0.7781);
	c.lineTo(w * 0.9814, h * 0.6094);
	c.lineTo(w, h * 0.6067);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w, h * 0.6254);
	c.lineTo(w * 0.7664, h * 0.792);
	c.lineTo(w * 0.9586, h * 0.9062);
	c.lineTo(w, h * 0.8786);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.3093, h * 0.5464);
	c.lineTo(w * 0.4271, h * 0.6152);
	c.lineTo(w * 0.245, h * 0.7643);
	c.lineTo(w * 0.185, h * 0.7228);
	c.lineTo(w * 0.2493, h * 0.6728);
	c.lineTo(w * 0.2214, h * 0.6143);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(0, h * 0.65);
	c.lineTo(w * 0.2179, h * 0.7826);
	c.lineTo(w * 0.1136, h * 0.8424);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(0, h * 0.7272);
	c.lineTo(w * 0.0821, h * 0.859);
	c.lineTo(0, h * 0.9085);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.4529, h * 0.6366);
	c.lineTo(w * 0.575, h * 0.7143);
	c.lineTo(w * 0.39, h * 0.8621);
	c.lineTo(w * 0.2657, h * 0.7902);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(0, h * 0.9415);
	c.lineTo(w * 0.1036, h * 0.8821);
	c.lineTo(w * 0.2343, h * 0.959);
	c.lineTo(w * 0.1721, h);
	c.lineTo(0, h);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.2586, h * 0.7951);
	c.lineTo(w * 0.3829, h * 0.8674);
	c.lineTo(w * 0.2543, h * 0.9451);
	c.lineTo(w * 0.1279, h * 0.8692);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.2836, h * 0.9639);
	c.lineTo(w * 0.4207, h * 0.8772);
	c.lineTo(w * 0.605, h * 0.7321);
	c.lineTo(w * 0.6521, h * 0.7634);
	c.lineTo(w * 0.3486, h);
	c.lineTo(w * 0.3393, h);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.3879, h);
	c.lineTo(w * 0.6721, h * 0.7759);
	c.lineTo(w * 0.7171, h * 0.7982);
	c.lineTo(w * 0.4564, h);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.4986, h);
	c.lineTo(w * 0.7386, h * 0.8125);
	c.lineTo(w * 0.9307, h * 0.925);
	c.lineTo(w * 0.8264, h);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.8671, h);
	c.lineTo(w * 0.9464, h * 0.9491);
	c.lineTo(w, h * 0.975);
	c.lineTo(w, h);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.2295, h);
	c.lineTo(w * 0.2648, h * 0.9792);
	c.lineTo(w * 0.2981, h);
	c.close();
	c.fillAndStroke();

	c.setStrokeWidth(1);
	c.setStrokeColor(strokeColor);
	c.begin();
	c.rect(0, 0, w, h);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBG_MAP, mxShapeMockupiBgMap);

//**********************************************************************************************************************************************************
//Vertical Button Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiButtonBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiButtonBar, mxShape);

mxShapeMockupiButtonBar.prototype.customProperties = [
	{name: 'buttonText', dispName: 'Labels', type: 'string'},
	{name: 'textColor', dispName: 'Text Color', type: 'color'},
	{name: 'textColor2', dispName: 'Text2 Color', type: 'color'},
	{name: 'strokeColor2', dispName: 'Stroke2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiButtonBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxMockupC.STYLE_STROKECOLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var buttonNum = textStrings.length;
	var maxButtonWidth = 0;
	var selectedButton = -1;
	var rSize = 2.5; //rounding size
	var labelOffset = 2.5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxMockupC.SELECTED)
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

	this.background(c, trueW, trueH, rSize, buttonNum, labelOffset, buttonNum * minButtonHeight, frameColor, separatorColor, bgColor, selectedButton, minButtonHeight);
	c.setShadow(false);

	this.foreground(c, trueW, trueH, rSize, buttonNum, labelOffset, buttonNum * minButtonHeight, frameColor, separatorColor, bgColor, selectedButton, minButtonHeight);
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
		var currHeight = (i * minButtonHeight + minButtonHeight * 0.5) * trueH / minH;
		this.buttonText(c, trueW, currHeight, textStrings[i], fontSize, separatorColor);
	}
};

mxShapeMockupiButtonBar.prototype.background = function(c, w, h, rSize, buttonNum, labelOffset, minH, frameColor, separatorColor, bgColor, selectedButton, minButtonHeight)
{
	c.begin();
	c.setStrokeWidth(1);

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
};

mxShapeMockupiButtonBar.prototype.foreground = function(c, w, h, rSize, buttonNum, labelOffset, minH, frameColor, separatorColor, bgColor, selectedButton, minButtonHeight)
{
	//draw the button separators
	var strokeWidth = mxUtils.getValue(this.style, mxConstants.STYLE_STROKEWIDTH, '1');
	c.setStrokeWidth(strokeWidth);
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
	c.setStrokeColor(mxConstants.NONE);

	if (selectedButton === 0)
	{
		// we draw a path for the first button
		c.begin();
		var buttonBottom = minButtonHeight * h / minH;
		c.setGradient('#5D7585', '#008cff', 0, 0, w, buttonBottom, mxConstants.DIRECTION_SOUTH, 1, 1);
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
		c.setGradient('#5D7585', '#008cff', 0, buttonTop, w, h - buttonTop, mxConstants.DIRECTION_SOUTH, 1, 1);
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
		c.setGradient('#5D7585', '#008cff', 0, buttonTop, w, buttonBottom - buttonTop, mxConstants.DIRECTION_SOUTH, 1, 1);
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

mxShapeMockupiButtonBar.prototype.buttonText = function(c, w, h, textString, fontSize, separatorColor)
{
	if(textString.charAt(0) === mxMockupC.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.setFontSize(fontSize);
	c.text(10, h, 0, 0, textString, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var mSize = fontSize * 0.5;
	c.setStrokeWidth(fontSize * 0.3);
	c.setStrokeColor(separatorColor);
	c.begin();
	c.moveTo(w - 20 - mSize, h - mSize);
	c.lineTo(w - 20, h);
	c.lineTo(w - 20 - mSize, h + mSize);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBUTTON_BAR, mxShapeMockupiButtonBar);

//**********************************************************************************************************************************************************
//iPhone Application Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiAppBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiAppBar, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiAppBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiAppBar.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#eeeeee', '#999999', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiAppBar.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#0099ff');
	c.rect(5, h * 0.5 + 1.75, 1.5, 2.5);
	c.fill();

	c.rect(7, h * 0.5 + 0.75, 1.5, 3.5);
	c.fill();

	c.rect(9, h * 0.5 - 0.25, 1.5, 4.5);
	c.fill();

	c.rect(11, h * 0.5 - 1.25, 1.5, 5.5);
	c.fill();

	c.rect(13, h * 0.5 - 2.25, 1.5, 6.5);
	c.fill();

	c.rect(15, h * 0.5 - 3.25, 1.5, 7.5);
	c.fill();

	c.setFillColor('#999999');
	c.ellipse(w - 56.5, h * 0.5 - 4, 8, 8);
	c.fill();

	c.setStrokeColor('#cccccc');
	c.begin();
	c.moveTo(w - 52.5, h * 0.5 - 3);
	c.lineTo(w - 52.5, h * 0.5);
	c.lineTo(w - 54.5, h * 0.5);
	c.stroke();

	c.setStrokeWidth(0.5);
	c.setStrokeColor('#333333');
	c.setFillColor('#990000');
	c.begin();
	c.moveTo(w - 45.5, h * 0.5);
	c.lineTo(w - 37.5, h * 0.5 - 5);
	c.lineTo(w - 41.5, h * 0.5 + 4);
	c.lineTo(w - 42, h * 0.5 + 0.5);
	c.close();
	c.fillAndStroke();

	c.setFillColor('#999999');
	c.setStrokeColor('#999999');
	c.begin();
	c.moveTo(w - 28.5, h * 0.5 + 3.5);
	c.arcTo(3.5, 3.5, 0, 1, 1, w - 26.5, h * 0.5 + 1);
	c.stroke();

	c.begin();
	c.moveTo(w - 27.25, h * 0.5 + 0.25);
	c.lineTo(w - 25.75, h * 0.5 + 0.25);
	c.lineTo(w - 26.5, h * 0.5 + 1.5);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w - 31, h * 0.5 - 0.5);
	c.arcTo(1, 1.5, 0, 0, 1, w - 29, h * 0.5 - 0.5);
	c.stroke();

	c.rect(w - 31.5, h * 0.5 - 0.5, 3, 2);
	c.fillAndStroke();

	c.setGradient('#eeeeee', '#444444', w - 20, h * 0.5 - 3, 16.5, 6, mxConstants.DIRECTION_NORTH, 1, 1);
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
	c.fill();

	c.setGradient('#E2FFEB', '#008215', w - 20, h * 0.5 - 3, 10, 6, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(w - 20, h * 0.5 - 3);
	c.lineTo(w - 10, h * 0.5 - 3);
	c.lineTo(w - 10, h * 0.5 + 3);
	c.lineTo(w - 20, h * 0.5 + 3);
	c.close();
	c.fill();

	c.setStrokeColor('#666666');
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

mxCellRenderer.registerShape(mxMockupC.SHAPE_IAPP_BAR, mxShapeMockupiAppBar);

//**********************************************************************************************************************************************************
//iPhone Top Bar (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiTopBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiTopBar, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiTopBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiTopBar.prototype.background = function(c, x, y, w, h)
{
	c.setAlpha(0.5);
	c.setFillColor('#999999');
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiTopBar.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#cccccc');
	c.setStrokeColor('#cccccc');
	c.setFontColor('#cccccc');
	c.setFontSize(7.5);

	c.rect(5, h * 0.5 + 1.75, 1.5, 2.5);
	c.fill();

	c.rect(7, h * 0.5 + 0.75, 1.5, 3.5);
	c.fill();

	c.rect(9, h * 0.5 - 0.25, 1.5, 4.5);
	c.fill();

	c.rect(11, h * 0.5 - 1.25, 1.5, 5.5);
	c.fill();

	c.rect(13, h * 0.5 - 2.25, 1.5, 6.5);
	c.fill();

	c.rect(15, h * 0.5 - 3.25, 1.5, 7.5);
	c.fill();

	c.text(18, h * 0.5, 0, 0, 'CARRIER', mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.5, 0, 0, '11:15AM', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.begin();
	c.moveTo(w - 19, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 + 2);
	c.lineTo(w - 19, h * 0.5 + 2);
	c.close();
	c.fill();

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

mxCellRenderer.registerShape(mxMockupC.SHAPE_ITOP_BAR, mxShapeMockupiTopBar);

//**********************************************************************************************************************************************************
//iPhone Top Bar 2
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupiTopBar2(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiTopBar2, mxShape);

mxShapeMockupiTopBar2.prototype.cst = {
		SHAPE_ITOP_BAR2 : 'mxgraph.ios.iTopBar2'
};


/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupiTopBar2.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};
mxShapeMockupiTopBar2.prototype.background = function(c, x, y, w, h)
{
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiTopBar2.prototype.foreground = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setFillColor(strokeColor);
	c.setStrokeColor(strokeColor);

	c.rect(5, h * 0.5 + 1.75, 1.5, 2.5);
	c.fill();

	c.rect(7, h * 0.5 + 0.75, 1.5, 3.5);
	c.fill();

	c.rect(9, h * 0.5 - 0.25, 1.5, 4.5);
	c.fill();

	c.rect(11, h * 0.5 - 1.25, 1.5, 5.5);
	c.fill();

	c.rect(13, h * 0.5 - 2.25, 1.5, 6.5);
	c.fill();

	c.rect(15, h * 0.5 - 3.25, 1.5, 7.5);
	c.fill();

	c.begin();
	c.moveTo(w - 19, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 + 2);
	c.lineTo(w - 19, h * 0.5 + 2);
	c.close();
	c.fill();

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

mxCellRenderer.registerShape(mxShapeMockupiTopBar2.prototype.cst.SHAPE_ITOP_BAR2, mxShapeMockupiTopBar2);

//**********************************************************************************************************************************************************
//iPhone Top Bar Locked
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiTopBarLocked(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiTopBarLocked, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiTopBarLocked.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiTopBarLocked.prototype.background = function(c, x, y, w, h)
{
	c.setFillColor('#000000');
	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiTopBarLocked.prototype.foreground = function(c, x, y, w, h)
{
	c.setFillColor('#cccccc');
	c.setStrokeColor('#cccccc');

	c.rect(5, h * 0.5 + 1.75, 1.5, 2.5);
	c.fill();

	c.rect(7, h * 0.5 + 0.75, 1.5, 3.5);
	c.fill();

	c.rect(9, h * 0.5 - 0.25, 1.5, 4.5);
	c.fill();

	c.rect(11, h * 0.5 - 1.25, 1.5, 5.5);
	c.fill();

	c.rect(13, h * 0.5 - 2.25, 1.5, 6.5);
	c.fill();

	c.rect(15, h * 0.5 - 3.25, 1.5, 7.5);
	c.fill();

	c.begin();
	c.moveTo(w * 0.5 - 2, h * 0.5 - 1);
	c.arcTo(2, 3, 0, 0, 1, w * 0.5 + 2, h * 0.5 - 1);
	c.stroke();

	c.rect(w * 0.5 - 3, h * 0.5 - 1, 6, 4);
	c.fillAndStroke();


	c.begin();
	c.moveTo(w - 19, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 - 2);
	c.lineTo(w - 10, h * 0.5 + 2);
	c.lineTo(w - 19, h * 0.5 + 2);
	c.close();
	c.fill();

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

mxCellRenderer.registerShape(mxMockupC.SHAPE_ITOP_BAR_LOCKED, mxShapeMockupiTopBarLocked);

//**********************************************************************************************************************************************************
//Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiButton, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8.5').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupiButton.prototype.background = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.roundrect(0, 0, w, h, 2.5, 2.5);
	c.fill();
};

mxShapeMockupiButton.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w / 2, h / 2, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBUTTON, mxShapeMockupiButton);

//**********************************************************************************************************************************************************
//Button Back
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiButtonBack(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiButtonBack, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiButtonBack.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupiButtonBack.prototype.background = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	rSize = 2.5;
	c.begin();
	c.moveTo(w, rSize);
	c.arcTo(rSize, rSize, 0, 0, 0, w - rSize, 0);
	c.lineTo(10, 0);
	c.lineTo(0.87, h * 0.5 - 0.75);
	c.arcTo(rSize, rSize, 0, 0, 0, 0.87, h * 0.5 + 0.75);
	c.lineTo(10, h);
	c.lineTo(w - rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 0, w, h - rSize);
	c.close();	
	c.fill();
};

mxShapeMockupiButtonBack.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5 + 2.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBUTTON_BACK, mxShapeMockupiButtonBack);

//**********************************************************************************************************************************************************
//Button Forward
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiButtonForward(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiButtonForward, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiButtonForward.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '17').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupiButtonForward.prototype.background = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	rSize = 2.5;
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - 10, 0);
	c.lineTo(w - 0.87, h * 0.5 - 0.75);
	c.arcTo(rSize, rSize, 0, 0, 1, w - 0.87, h * 0.5 + 0.75);
	c.lineTo(w - 10, h);
	c.lineTo(rSize, h);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	c.close();	
	c.fill();
};

mxShapeMockupiButtonForward.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(w * 0.5 - 2.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IBUTTON_FORWARD, mxShapeMockupiButtonForward);

//**********************************************************************************************************************************************************
//Prev/Next Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiPrevNextButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiPrevNextButton, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiPrevNextButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiPrevNextButton.prototype.background = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	var rSize = 5;
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fill();

	c.begin();
	c.moveTo(w * 0.5, 0);
	c.lineTo(w * 0.5, h);
	c.stroke();
};

mxShapeMockupiPrevNextButton.prototype.foreground = function(c, x, y, w, h)
{
	var fillColor3 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR3, '').toString();
	c.setFillColor(fillColor3);

	c.begin();
	c.moveTo(w * 0.25, h * 0.25);
	c.lineTo(w * 0.35, h * 0.75);
	c.lineTo(w * 0.15, h * 0.75);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(w * 0.75, h * 0.75);
	c.lineTo(w * 0.85, h * 0.25);
	c.lineTo(w * 0.65, h * 0.25);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPREV_NEXT, mxShapeMockupiPrevNextButton);

//**********************************************************************************************************************************************************
//Text Input
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiTextInput(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiTextInput, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiTextInput.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#000000').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupiTextInput.prototype.background = function(c, x, y, w, h)
{
	c.roundrect(0, 0, w, h, 2.5, 2.5);
	c.fillAndStroke();
};

mxShapeMockupiTextInput.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(2, h * 0.5, 0, 0, text, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ITEXT_INPUT, mxShapeMockupiTextInput);

//**********************************************************************************************************************************************************
//Radio Button Group (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiRadioGroup(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiRadioGroup, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiRadioGroup.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8').toString();
	var optionText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Option 1').toString().split(',');
	var optionNum = optionText.length;
	var buttonSize = 5;
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

		if(currText.charAt(0) === mxMockupC.SELECTED)
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
	c.roundrect(0, 0, trueW, trueH, 2.5, 2.5);
	c.fillAndStroke();
	c.setShadow(false);

	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	for (var i = 0; i < optionNum; i++)
	{
		var currHeight = (i * lineH + lineH * 0.5) * trueH / minH;

		var currText = optionText[i];

		if(currText.charAt(0) === mxMockupC.SELECTED)
		{
			currText = optionText[i].substring(1);
			selected = i;
		}

		c.text(buttonSize * 2 + labelOffset, currHeight, 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		var iconX = buttonSize * 0.5;
		var iconY = currHeight - buttonSize * 0.5;
		c.setFillColor('#dddddd');
		c.setStrokeColor('#000000');

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

mxCellRenderer.registerShape(mxMockupC.SHAPE_IRADIO_GROUP, mxShapeMockupiRadioGroup);

//**********************************************************************************************************************************************************
//Checkbox Group (LEGACY)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCheckboxGroup(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCheckboxGroup, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCheckboxGroup.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8').toString();
	var optionText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Option 1').toString().split(',');
	var optionNum = optionText.length;
	var buttonSize = 5;
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

		if(currText.charAt(0) === mxMockupC.SELECTED)
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
	c.roundrect(0, 0, trueW, trueH, 2.5, 2.5);
	c.fillAndStroke();
	c.setShadow(false);

	c.setFontSize(fontSize);
	c.setFontColor(fontColor);

	for (var i = 0; i < optionNum; i++)
	{
		var currHeight = (i * lineH + lineH * 0.5) * trueH / minH;

		var currText = optionText[i];

		if(currText.charAt(0) === mxMockupC.SELECTED)
		{
			currText = optionText[i].substring(1);
			selected = i;
		}

		c.text(buttonSize * 2 + labelOffset, currHeight, 0, 0, currText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

		var iconX = buttonSize * 0.5;
		var iconY = currHeight - buttonSize * 0.5;
		c.setFillColor('#dddddd');
		c.setStrokeColor('#000000');

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

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICHECKBOX_GROUP, mxShapeMockupiCheckboxGroup);

//**********************************************************************************************************************************************************
//Combo box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiComboBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiComboBox, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiComboBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#666666').toString();
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8.5').toString();
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
	this.mainText(c, x, y, w, h, mainText, fontSize, fontColor);
};

mxShapeMockupiComboBox.prototype.background = function(c, x, y, w, h)
{
	c.setFillColor('#ffffff');
	c.roundrect(0, 0, w, h, 2.5, 2.5);
	c.fillAndStroke();
};

mxShapeMockupiComboBox.prototype.foreground = function(c, x, y, w, h)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, w - 30, 0, 30, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(w - 15, 0);
	c.lineTo(w - 2.5, 0);
	c.arcTo(2.5, 2.5, 0, 0, 1, w, 2.5);
	c.lineTo(w, h - 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, w - 2.5, h);
	c.lineTo(w - 15, h);
	c.close();
	c.fillAndStroke();

	c.setFillColor('#ffffff');
	c.begin();
	c.moveTo(w - 11, 5);
	c.lineTo(w - 7.5, 10);
	c.lineTo(w - 4, 5);
	c.fill();
};

mxShapeMockupiComboBox.prototype.mainText = function(c, x, y, w, h, text, fontSize, fontColor)
{
	c.begin();
	c.setFontSize(fontSize);
	c.setFontColor(fontColor);
	c.text(2.5, h * 0.5, 0, 0, text, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICOMBO_BOX, mxShapeMockupiComboBox);

//**********************************************************************************************************************************************************
//On-Off Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiOnOffButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiOnOffButton, mxShape);

mxShapeMockupiOnOffButton.prototype.customProperties = [
	{ name: 'buttonState', dispName: 'State', type: 'enum',
		enumList: [{val: 'on', dispName: 'On'}, {val: 'off', dispName: 'Off'}]}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiOnOffButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	w = Math.max(w, 2 * h);
	var state = mxUtils.getValue(this.style, mxMockupC.BUTTON_STATE, mxMockupC.STATE_ON);
	this.background(c, x, y, w, h, state);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, state);
	this.mainText(c, x, y, w, h, state);
};

mxShapeMockupiOnOffButton.prototype.background = function(c, x, y, w, h, state)
{
	if (state === mxMockupC.STATE_ON)
	{
		c.setGradient('#E2FFEB', '#008215', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.roundrect(0, 0, w, h, h * 0.5, h * 0.5);
		c.fillAndStroke();
	}
	else if (state === mxMockupC.STATE_OFF)
	{
		c.setGradient('#cc9999', '#881100', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.roundrect(0, 0, w, h, h * 0.5, h * 0.5);
		c.fillAndStroke();
	}
};

mxShapeMockupiOnOffButton.prototype.foreground = function(c, x, y, w, h, state)
{
	if (state === mxMockupC.STATE_ON)
	{
		c.setGradient('#ffffff', '#888888', w - h, 0, h, h, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(w - h, 0, h, h);
		c.fillAndStroke();
	}
	else
	{
		c.setGradient('#ffffff', '#888888', 0, 0, h, h, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(0, 0, h, h);
		c.fillAndStroke();
	}
};

mxShapeMockupiOnOffButton.prototype.mainText = function(c, x, y, w, h, state)
{
	var mainText = mxUtils.getValue(this.style, 'mainText', null);
	c.setFontColor('#ffffff');
	c.setFontSize(8.5);
	
	if (mainText != '')
	{
		if(state === mxMockupC.STATE_ON)
		{
			c.text(w * 0.5 - h * 0.4, h * 0.5, 0, 0, mainText || 'ON', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}
		else if (state === mxMockupC.STATE_OFF)
		{
			c.text(w * 0.5 + h * 0.4, h * 0.5, 0, 0, mainText || 'OFF', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		}
	}
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ION_OFF_BUTTON, mxShapeMockupiOnOffButton);

//**********************************************************************************************************************************************************
//Alert Box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiAlertBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiAlertBox, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiAlertBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(w, 15);
	h = Math.max(h, 15);
	c.translate(x, y);
	rSize = 7.5;
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeMockupiAlertBox.prototype.background = function(c, x, y, w, h, rSize)
{
	c.setGradient('#497198', '#193168', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.8);
	c.setStrokeWidth(1);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
};

mxShapeMockupiAlertBox.prototype.foreground = function(c, x, y, w, h, rSize)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text').toString().split(',');

	c.setStrokeColor('#497198');
	c.setGradient('#497198', '#c5cee1', 0, 0, w, 22.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.5);
	c.begin();
	c.moveTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, 17.5);
	c.arcTo(w * 1.67, h * 2.5, 0, 0, 1, 0, 17.5);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fillAndStroke();

	c.setAlpha(0.8);
	c.setStrokeColor('#ffffff');
	c.setStrokeWidth(1);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.stroke();

	c.setGradient('#497198', '#c5cee1', 5, h - 50, w - 20, 20, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(5, h - 25, w - 10, 20, 2.5, 2.5);
	c.fillAndStroke();

	c.setAlpha(0.9);
	c.setFontSize(9.5);
	c.setFontColor('#ffffff');
	c.text(w * 0.5, h * 0.15, 0, 0, mainText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(8);
	c.text(w * 0.5, h * 0.4, 0, 0, mainText[2], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.55, 0, 0, mainText[3], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(8.5);
	c.text(w * 0.5, h - 15, 0, 0, mainText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IALERT_BOX, mxShapeMockupiAlertBox);

//**********************************************************************************************************************************************************
//Dialog Box
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiDialogBox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiDialogBox, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiDialogBox.prototype.paintVertexShape = function(c, x, y, w, h)
{
	w = Math.max(w, 15);
	h = Math.max(h, 15);
	c.translate(x, y);
	rSize = 7.5;
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeMockupiDialogBox.prototype.background = function(c, x, y, w, h, rSize)
{
	c.setGradient('#497198', '#193168', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.8);
	c.setStrokeWidth(1);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
};

mxShapeMockupiDialogBox.prototype.foreground = function(c, x, y, w, h, rSize)
{
	var mainText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Main Text').toString().split(',');

	c.setStrokeColor('#497198');
	c.setGradient('#497198', '#c5cee1', 0, 0, w, 22.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.5);
	c.begin();
	c.moveTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, 17.5);
	c.arcTo(w * 1.67, h * 2.5, 0, 0, 1, 0, 17.5);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fillAndStroke();

	c.setAlpha(0.8);
	c.setStrokeColor('#ffffff');
	c.setStrokeWidth(1);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.stroke();

	c.setGradient('#497198', '#c5cee1', 5, h - 25, w * 0.5 - 10, 20, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(5, h - 25, w * 0.5 - 10, 20, 2.5, 2.5);
	c.fillAndStroke();

	c.roundrect(w * 0.5 + 2.5, h - 25, w * 0.5 - 10, 20, 2.5, 2.5);
	c.fillAndStroke();

	c.setAlpha(0.9);
	c.setFontSize(9.5);
	c.setFontColor('#ffffff');
	c.text(w * 0.5, h * 0.15, 0, 0, mainText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(8);
	c.text(w * 0.5, h * 0.4, 0, 0, mainText[3], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.55, 0, 0, mainText[4], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(8.5);
	c.text(w * 0.25, h - 15, 0, 0, mainText[1], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.75, h - 15, 0, 0, mainText[2], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IDIALOG_BOX, mxShapeMockupiDialogBox);

//**********************************************************************************************************************************************************
//Lock Button
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiLockButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiLockButton, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiLockButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);

	c.setAlpha(0.7);
	c.setGradient('#4A4F56', '#70757B', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
	c.rect(0, 0, w, h);
	c.fill();

	c.setAlpha(0.8);
	c.setGradient('#18232D', '#1F2933', 10, 10, 154, 30, mxConstants.DIRECTION_NORTH, 1, 1);
	c.roundrect(10, h * 0.5 - 15, w - 20, 30, 7.5, 7.5);
	c.fill();

	c.setAlpha(1);
	c.setGradient('#E9F3FD', '#ADB7C1', 12.5, 12.5, 40, 25, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(12.5, h * 0.5 - 12.5, 40, 25, 5, 5);
	c.fill();

	c.setAlpha(0.8);
	c.setStrokeWidth(0.5);
	c.setStrokeColor('#aabbbb');
	c.setGradient('#AEB7C1', '#667079', 20, 17.5, 25, 15, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(20, h * 0.5 - 3.5);
	c.lineTo(35, h * 0.5 - 3.5);
	c.lineTo(35, h * 0.5 - 7.5);
	c.lineTo(45, h * 0.5);
	c.lineTo(35, h * 0.5 + 7.5);
	c.lineTo(35, h * 0.5 + 3.5);
	c.lineTo(20, h * 0.5 + 3.5);
	c.close();
	c.fillAndStroke();
	
	var mainText = mxUtils.getValue(this.style, 'mainText', null);
	
	if (mainText != '')
	{
		c.setFontSize(12.5);
		c.setFontColor('#cccccc');
		c.text(w / 2 + 20.5, h / 2, 0, 0, 'slide to unlock', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ILOCK_BUTTON, mxShapeMockupiLockButton);

//**********************************************************************************************************************************************************
//Arrow Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiArrowIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiArrowIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiArrowIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiArrowIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiArrowIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.4, h * 0.22);
	c.lineTo(w * 0.65, h * 0.5);
	c.lineTo(w * 0.4, h * 0.78);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IARROW_ICON, mxShapeMockupiArrowIcon);

//**********************************************************************************************************************************************************
//Delete Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiDeleteIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiDeleteIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiDeleteIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiDeleteIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiDeleteIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.25, h * 0.5);
	c.lineTo(w * 0.75, h * 0.5);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IDELETE_ICON, mxShapeMockupiDeleteIcon);

//**********************************************************************************************************************************************************
//Add Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiAddIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiAddIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiAddIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setStrokeColor(strokeColor);


	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiAddIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(1.5);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiAddIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.25, h * 0.5);
	c.lineTo(w * 0.75, h * 0.5);
	c.moveTo(w * 0.5, h * 0.25);
	c.lineTo(w * 0.5, h * 0.75);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IADD_ICON, mxShapeMockupiAddIcon);

//**********************************************************************************************************************************************************
//Info Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiInfoIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiInfoIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiInfoIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiInfoIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiInfoIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.setFillColor('#ffffff');
	c.moveTo(w * 0.47, h * 0.334);
	c.arcTo(w * 0.1, h * 0.15, 60, 0, 1, w * 0.61, h * 0.42);
	c.lineTo(w * 0.51, h * 0.7);
	c.arcTo(w * 0.026, h * 0.03, 30, 0, 0, w * 0.54, h * 0.74);
	c.lineTo(w * 0.608, h * 0.684);
	c.arcTo(w * 0.02, h * 0.015, 0, 0, 1, w * 0.638, h * 0.706);
	c.arcTo(w * 0.45, h * 0.45, 0, 0, 1, w * 0.42, h * 0.865);
	c.arcTo(w * 0.1, h * 0.08, -15, 0, 1, w * 0.325, h * 0.77);
	c.lineTo(w * 0.358, h * 0.66);
	c.lineTo(w * 0.435, h * 0.46);
	c.arcTo(w * 0.023, h * 0.03, 0, 0, 0, w * 0.4, h * 0.43);
	c.lineTo(w * 0.338, h * 0.484);
	c.arcTo(w * 0.01, h * 0.015, 45, 0, 1, w * 0.31, h * 0.47);
	c.arcTo(w * 0.3, h * 0.3, 0, 0, 1, w * 0.47, h * 0.334);
	c.fill();

	c.begin();
	c.moveTo(w * 0.5438, h * 0.141);
	c.arcTo(w * 0.0776, h * 0.0898, 40, 0, 1, w * 0.6671, h * 0.2308);
	c.arcTo(w * 0.0776, h * 0.0898, 40, 0, 1, w * 0.5438, h * 0.141);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IINFO_ICON, mxShapeMockupiInfoIcon);


//**********************************************************************************************************************************************************
//Sort/Find Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiSortFindIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiSortFindIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiSortFindIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiSortFindIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.roundrect(0, 0, w, h, w * 0.1, h * 0.1);
	c.fillAndStroke();
};

mxShapeMockupiSortFindIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth((Math.min(h, w)) / 20);
	c.begin();
	c.setFillColor('#ffffff');
	c.moveTo(w * 0.1, h * 0.25);
	c.lineTo(w * 0.9, h * 0.25);
	c.moveTo(w * 0.1, h * 0.4);
	c.lineTo(w * 0.9, h * 0.4);
	c.moveTo(w * 0.1, h * 0.55);
	c.lineTo(w * 0.6, h * 0.55);
	c.moveTo(w * 0.1, h * 0.7);
	c.lineTo(w * 0.5, h * 0.7);
	c.stroke();

	c.begin();
	c.ellipse(w * 0.6, h * 0.6, w * 0.2, h * 0.2);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.77, h * 0.77);
	c.lineTo(w * 0.85, h * 0.85);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ISORT_FIND_ICON, mxShapeMockupiSortFindIcon);

//**********************************************************************************************************************************************************
//Check Icon
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCheckIcon(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCheckIcon, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCheckIcon.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, strokeColor);
};

mxShapeMockupiCheckIcon.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiCheckIcon.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.25, h * 0.5);
	c.lineTo(w * 0.5, h * 0.65);
	c.lineTo(w * 0.75, h * 0.25);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICHECK_ICON, mxShapeMockupiCheckIcon);

//**********************************************************************************************************************************************************
//Keyboard (letters)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiKeybLetters(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiKeybLetters, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiKeybLetters.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiKeybLetters.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#8A97A7', '#425163', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiKeybLetters.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setGradient('#EEF3F9', '#DBE2E9', w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	rSizeX = w * 0.0144;
	rSizeY = h * 0.025;
	c.setFontSize(10.5);
	c.setFontColor('#000000');

	c.roundrect(w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0474, h * 0.125, 0, 0, 'Q', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1092, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.148, h * 0.125, 0, 0, 'W', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2098, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2486, h * 0.125, 0, 0, 'E', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3103, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3491, h * 0.125, 0, 0, 'R', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4109, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4497, h * 0.125, 0, 0, 'T', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5115, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5503, h * 0.125, 0, 0, 'Y', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6121, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6509, h * 0.125, 0, 0, 'U', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7126, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7514, h * 0.125, 0, 0, 'I', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8132, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.852, h * 0.125, 0, 0, 'O', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.9138, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9526, h * 0.125, 0, 0, 'P', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.0632, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.102, h * 0.375, 0, 0, 'A', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1638, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2026, h * 0.375, 0, 0, 'S', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2644, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3032, h * 0.375, 0, 0, 'D', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3649, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4037, h * 0.375, 0, 0, 'F', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4655, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5043, h * 0.375, 0, 0, 'G', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5661, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6049, h * 0.375, 0, 0, 'H', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6667, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7055, h * 0.375, 0, 0, 'J', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7672, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.806, h * 0.375, 0, 0, 'K', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8678, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9066, h * 0.375, 0, 0, 'L', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);


	c.roundrect(w * 0.1638, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2026, h * 0.625, 0, 0, 'Z', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2644, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3032, h * 0.625, 0, 0, 'X', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3649, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4037, h * 0.625, 0, 0, 'C', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4655, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5043, h * 0.625, 0, 0, 'V', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5661, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6049, h * 0.625, 0, 0, 'B', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6667, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7055, h * 0.625, 0, 0, 'N', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7672, h * 0.53, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.806, h * 0.625, 0, 0, 'M', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);


	c.roundrect(w * 0.2644, h * 0.78, w * 0.4799, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.setFontColor('#666666');
	c.text(w * 0.5043, h * 0.875, 0, 0, 'space', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontColor('#ffffff');

	c.setGradient('#8B98A8', '#677488', w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, rSizeX, rSizeY);
	c.fill();

	c.setGradient('#8B98A8', '#677488', w * 0.8736, h * 0.53, w * 0.115, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(w * 0.8736, h * 0.53, w * 0.115, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.setGradient('#8B98A8', '#677488', w * 0.0115, h * 0.78, w * 0.2299, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(w * 0.0115, h * 0.78, w * 0.2299, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.setGradient('#8B98A8', '#677488', w * 0.7672, h * 0.78, w * 0.2213, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(w * 0.7672, h * 0.78, w * 0.2213, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.1264, h * 0.875, 0, 0, '.?123', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8779, h * 0.875, 0, 0, 'return', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setShadow(false);
	c.setLineJoin('round');
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	c.setStrokeWidth(1.5);
	c.begin();
	c.moveTo(w * 0.0402, h * 0.635);
	c.lineTo(w * 0.0718, h * 0.58);
	c.lineTo(w * 0.1034, h * 0.635);
	c.lineTo(w * 0.0862, h * 0.635);
	c.lineTo(w * 0.0862, h * 0.67);
	c.lineTo(w * 0.0575, h * 0.67);
	c.lineTo(w * 0.0575, h * 0.635);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(w * 0.9109, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.665);
	c.lineTo(w * 0.9109, h * 0.665);
	c.lineTo(w * 0.8879, h * 0.625);
	c.close();
	c.fillAndStroke();

	c.setStrokeColor('#677488');
	c.begin();
	c.moveTo(w * 0.9224, h * 0.605);
	c.lineTo(w * 0.9454, h * 0.645);
	c.moveTo(w * 0.9224, h * 0.645);
	c.lineTo(w * 0.9454, h * 0.605);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IKEYB_LETTERS, mxShapeMockupiKeybLetters);

//**********************************************************************************************************************************************************
//Keyboard (numbers)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiKeybNumbers(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiKeybNumbers, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiKeybNumbers.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiKeybNumbers.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#8A97A7', '#425163', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiKeybNumbers.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setGradient('#EEF3F9', '#DBE2E9', w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	rSizeX = w * 0.0144;
	rSizeY = h * 0.025;
	c.setFontSize(10.5);
	c.setFontColor('#000000');

	c.roundrect(w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0474, h * 0.125, 0, 0, '1', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1092, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.148, h * 0.125, 0, 0, '2', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2098, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2486, h * 0.125, 0, 0, '3', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3103, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3491, h * 0.125, 0, 0, '4', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4109, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4497, h * 0.125, 0, 0, '5', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5115, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5503, h * 0.125, 0, 0, '6', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6121, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6509, h * 0.125, 0, 0, '7', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7126, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7514, h * 0.125, 0, 0, '8', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8132, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.852, h * 0.125, 0, 0, '9', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.9138, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9526, h * 0.125, 0, 0, '0', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.0086, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0474, h * 0.375, 0, 0, '-', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1092, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.148, h * 0.375, 0, 0, '/', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2098, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2486, h * 0.375, 0, 0, ':', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3103, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3491, h * 0.375, 0, 0, ';', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4109, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4497, h * 0.375, 0, 0, '(', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5115, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5503, h * 0.375, 0, 0, ')', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6121, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6509, h * 0.375, 0, 0, '$', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7126, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7514, h * 0.375, 0, 0, '&', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8132, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.852, h * 0.375, 0, 0, '@', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.9138, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9526, h * 0.375, 0, 0, '\"', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1638, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2227, h * 0.625, 0, 0, '.', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3046, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3635, h * 0.625, 0, 0, ',', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4454, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5043, h * 0.625, 0, 0, '?', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5862, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6451, h * 0.625, 0, 0, '!', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.727, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7859, h * 0.625, 0, 0, '\'', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);


	c.roundrect(w * 0.2644, h * 0.78, w * 0.4799, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.setFontColor('#666666');
	c.text(w * 0.5043, h * 0.875, 0, 0, 'space', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setGradient('#8B98A8', '#677488', w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setFontColor('#ffffff');

	c.roundrect(w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, rSizeX, rSizeY);
	c.fill();

	c.roundrect(w * 0.8736, h * 0.53, w * 0.115, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.roundrect(w * 0.0115, h * 0.78, w * 0.2299, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.roundrect(w * 0.7672, h * 0.78, w * 0.2213, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0718, h * 0.625, 0, 0, '#+=', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.1264, h * 0.875, 0, 0, 'ABC', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8779, h * 0.875, 0, 0, 'return', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setShadow(false);
	c.setLineJoin('round');
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	c.setStrokeWidth(1.5);
	c.begin();
	c.moveTo(w * 0.9109, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.665);
	c.lineTo(w * 0.9109, h * 0.665);
	c.lineTo(w * 0.8879, h * 0.625);
	c.close();
	c.fillAndStroke();

	c.setStrokeColor('#677488');
	c.begin();
	c.moveTo(w * 0.9224, h * 0.605);
	c.lineTo(w * 0.9454, h * 0.645);
	c.moveTo(w * 0.9224, h * 0.645);
	c.lineTo(w * 0.9454, h * 0.605);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IKEYB_NUMBERS, mxShapeMockupiKeybNumbers);

//**********************************************************************************************************************************************************
//Keyboard (symbols)
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiKeybSymbols(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiKeybSymbols, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiKeybSymbols.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(true);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiKeybSymbols.prototype.background = function(c, x, y, w, h)
{
	c.setGradient('#8A97A7', '#425163', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.rect(0, 0, w, h);
	c.fill();
};

mxShapeMockupiKeybSymbols.prototype.foreground = function(c, x, y, w, h, strokeColor)
{
	c.setGradient('#EEF3F9', '#DBE2E9', w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	rSizeX = w * 0.0144;
	rSizeY = h * 0.025;
	c.setFontSize(10.5);
	c.setFontColor('#000000');

	c.roundrect(w * 0.0086, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0474, h * 0.125, 0, 0, '[', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1092, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.148, h * 0.125, 0, 0, ']', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2098, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2486, h * 0.125, 0, 0, '{', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3103, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3491, h * 0.125, 0, 0, '}', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4109, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4497, h * 0.125, 0, 0, '#', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5115, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5503, h * 0.125, 0, 0, '%', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6121, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6509, h * 0.125, 0, 0, '^', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7126, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7514, h * 0.125, 0, 0, '*', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8132, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.852, h * 0.125, 0, 0, '+', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.9138, h * 0.03, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9526, h * 0.125, 0, 0, '=', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.0086, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0474, h * 0.375, 0, 0, '_', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1092, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.148, h * 0.375, 0, 0, '\\', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2098, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2486, h * 0.375, 0, 0, '|', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3103, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3491, h * 0.375, 0, 0, '~', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4109, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.4497, h * 0.375, 0, 0, '<', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5115, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5503, h * 0.375, 0, 0, '>', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.6121, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6509, h * 0.375, 0, 0, String.fromCharCode(128), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.7126, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7514, h * 0.375, 0, 0, String.fromCharCode(parseInt('00A3', 16)), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.8132, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.852, h * 0.375, 0, 0, String.fromCharCode(parseInt('00A5', 16)), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.9138, h * 0.28, w * 0.0776, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.9526, h * 0.375, 0, 0, String.fromCharCode(parseInt('0095', 16)), mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.1638, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.2227, h * 0.625, 0, 0, '.', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.3046, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.3635, h * 0.625, 0, 0, ',', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.4454, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.5043, h * 0.625, 0, 0, '?', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.5862, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.6451, h * 0.625, 0, 0, '!', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.727, h * 0.53, w * 0.1178, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.7859, h * 0.625, 0, 0, '\'', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.roundrect(w * 0.2644, h * 0.78, w * 0.4799, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.setFontColor('#666666');
	c.text(w * 0.5043, h * 0.875, 0, 0, 'space', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setGradient('#8B98A8', '#677488', w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setFontColor('#ffffff');

	c.roundrect(w * 0.0115, h * 0.53, w * 0.1207, h * 0.19, rSizeX, rSizeY);
	c.fill();

	c.roundrect(w * 0.8736, h * 0.53, w * 0.115, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.roundrect(w * 0.0115, h * 0.78, w * 0.2299, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.roundrect(w * 0.7672, h * 0.78, w * 0.2213, h * 0.19, rSizeX, rSizeY);
	c.fill();
	c.text(w * 0.0718, h * 0.625, 0, 0, '123', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.1264, h * 0.875, 0, 0, 'ABC', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8779, h * 0.875, 0, 0, 'return', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setShadow(false);
	c.setLineJoin('round');
	c.setStrokeColor('#ffffff');
	c.setFillColor('#ffffff');
	c.setStrokeWidth(1.5);
	c.begin();
	c.moveTo(w * 0.9109, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.585);
	c.lineTo(w * 0.9655, h * 0.665);
	c.lineTo(w * 0.9109, h * 0.665);
	c.lineTo(w * 0.8879, h * 0.625);
	c.close();
	c.fillAndStroke();

	c.setStrokeColor('#677488');
	c.begin();
	c.moveTo(w * 0.9224, h * 0.605);
	c.lineTo(w * 0.9454, h * 0.645);
	c.moveTo(w * 0.9224, h * 0.645);
	c.lineTo(w * 0.9454, h * 0.605);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IKEYB_SYMBOLS, mxShapeMockupiKeybSymbols);

//**********************************************************************************************************************************************************
//Delete App
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiDeleteApp(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiDeleteApp, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiDeleteApp.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '').toString();

	c.translate(x, y);
	this.background(c, x, y, w, h, strokeColor);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiDeleteApp.prototype.background = function(c, x, y, w, h, strokeColor)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '').toString();
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '').toString();
	c.setGradient(fillColor, fillColor2, 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor(strokeColor);
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiDeleteApp.prototype.foreground = function(c, x, y, w, h)
{
	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.3, h * 0.3);
	c.lineTo(w * 0.7, h * 0.7);
	c.moveTo(w * 0.3, h * 0.7);
	c.lineTo(w * 0.7, h * 0.3);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IDELETE_APP, mxShapeMockupiDeleteApp);

//**********************************************************************************************************************************************************
//Direction
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiDirection(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiDirection, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiDirection.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiDirection.prototype.background = function(c, x, y, w, h)
{
	c.setStrokeWidth(0.5);
	c.setStrokeColor('#008cff');
	c.ellipse(0, 0, w, h);
	c.stroke();
};

mxShapeMockupiDirection.prototype.foreground = function(c, x, y, w, h)
{
	c.setAlpha(1);
	c.setGradient('#ffffff', '#ffffff', w * 0.29, h * 0.2, w * 0.42, h * 0.3, mxConstants.DIRECTION_NORTH, 1, 0);
	c.begin();
	c.moveTo(w * 0.29, h * 0.2);
	c.lineTo(w * 0.5, h * 0.5);
	c.lineTo(w * 0.71, h * 0.2);
	c.fillAndStroke();

	c.setStrokeColor('#006cdf');
	c.setGradient('#ffffff', '#007cef', w * 0.47, h * 0.47, w * 0.06, h * 0.06, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(1);
	c.ellipse(w * 0.47, h * 0.47, w * 0.06, h * 0.06);
	c.fillAndStroke();

	c.setFillColor('#ffffff');
	c.setAlpha(0.8);
	c.ellipse(w * 0.4825, h * 0.4825, w * 0.015, h * 0.015);
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IDIRECTION, mxShapeMockupiDirection);

//**********************************************************************************************************************************************************
//Location Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiLocationBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiLocationBar, mxShape);

mxShapeMockupiLocationBar.prototype.customProperties = [
	{name: 'buttonText', dispName: 'Text', type: 'string'},
	{name: 'barPos', dispName: 'Callout Position', type: 'float', min:0, defVal:80},
	{name: 'pointerPos', dispName: 'Callout Orientation', type: 'enum',
		enumList: [{val: 'bottom', dispName: 'Bottom'}, {val: 'top', dispName: 'Top'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiLocationBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiLocationBar.prototype.background = function(c, x, y, w, h)
{
	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var pointerPos = mxUtils.getValue(this.style, mxMockupC.POINTER_POS, mxMockupC.POINTER_BOTTOM);
	var rSize = 2.5;
	var deadzone = rSize + 7.5; // rounding + pointer width / 2 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;
	c.setStrokeWidth(0.5);
	c.setStrokeColor('#000000');
	c.setAlpha(0.7);
	c.begin();

	if (pointerPos === mxMockupC.POINTER_BOTTOM)
	{
		c.setGradient('#000000', '#888888', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize - 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h - 7.5);
		c.lineTo(truePos + 7.5, h - 7.5);
		c.lineTo(truePos, h);
		c.lineTo(truePos - 7.5, h - 7.5);
		c.lineTo(rSize, h - 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize - 7.5);
	}
	else if (pointerPos === mxMockupC.POINTER_TOP)
	{
		c.setGradient('#000000', '#888888', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
		c.moveTo(0, rSize + 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 7.5);
		c.lineTo(truePos - 7.5, 7.5);
		c.lineTo(truePos, 0);
		c.lineTo(truePos + 7.5, 7.5);
		c.lineTo(w - rSize, 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize + 7.5);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}

	c.close();
	c.fillAndStroke();
};

mxShapeMockupiLocationBar.prototype.foreground = function(c, x, y, w, h)
{
	var pointerPos = mxUtils.getValue(this.style, mxMockupC.POINTER_POS, mxMockupC.POINTER_BOTTOM);
	var locText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Some Location');
	c.setAlpha(1);
	c.setFontColor('#ffffff');
	c.setFontSize(9.5);

	if (pointerPos === mxMockupC.POINTER_BOTTOM)
	{
		c.text(5, (h - 7.5) * 0.5, 0, 0, locText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		c.translate(w - 20, (h - 7.5) * 0.5 - 7.5);
	}
	else
	{
		c.text(5, (h + 7.5) * 0.5, 0, 0, locText, mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
		c.translate(w - 20, (h + 7.5) * 0.5 - 7.5);
	}		

	w = 15;
	h = 15;

	c.setGradient('#8BbEff', '#135Ec8', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);

	c.setStrokeWidth(1.5);
	c.setStrokeColor('#ffffff');
	c.ellipse(0, 0, w, h);
	c.fillAndStroke();

	c.setStrokeWidth(2.5);
	c.begin();
	c.moveTo(w * 0.4, h * 0.22);
	c.lineTo(w * 0.65, h * 0.5);
	c.lineTo(w * 0.4, h * 0.78);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ILOCATION_BAR, mxShapeMockupiLocationBar);

//**********************************************************************************************************************************************************
//Call Dialog
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCallDialog(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCallDialog, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCallDialog.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var rSize = 5;
	c.translate(x, y);
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeMockupiCallDialog.prototype.background = function(c, x, y, w, h, rSize)
{
	c.setAlpha(0.8);
	c.setStrokeColor('#888888');
	c.setStrokeWidth(1.5);
	c.setFillColor('#000000');
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
};

mxShapeMockupiCallDialog.prototype.foreground = function(c, x, y, w, h, rSize)
{

	c.begin();
	c.moveTo(w * 0.33, 0);
	c.lineTo(w * 0.33, h);
	c.moveTo(w * 0.67, 0);
	c.lineTo(w * 0.67, h);
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.stroke();

	c.setStrokeColor('#000000');
	c.setFillColor('#ffffff');
	c.setStrokeWidth(0.5);
	c.roundrect(w * 0.1433, h * 0.104, w * 0.0417, h * 0.148, w * 0.02, h * 0.024);
	c.fill();

	c.begin();
	c.moveTo(w * 0.14, h * 0.188);
	c.lineTo(w * 0.14, h * 0.228);
	c.arcTo(w * 0.025, h * 0.03, 0, 0, 0, w * 0.19, h * 0.228);
	c.lineTo(w * 0.19, h * 0.188);
	c.lineTo(w * 0.2, h * 0.188);
	c.lineTo(w * 0.2, h * 0.228);
	c.arcTo(w * 0.0367, h * 0.044, 0, 0, 1, w * 0.17, h * 0.27);
	c.lineTo(w * 0.17, h * 0.296);
	c.lineTo(w * 0.195, h * 0.296);
	c.lineTo(w * 0.195, h * 0.308);
	c.lineTo(w * 0.1367, h * 0.308);
	c.lineTo(w * 0.1367, h * 0.296);
	c.lineTo(w * 0.16, h * 0.296);
	c.lineTo(w * 0.16, h * 0.27);
	c.arcTo(w * 0.0367, h * 0.044, 0, 0, 1, w * 0.13, h * 0.228);
	c.lineTo(w * 0.13, h * 0.188);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.moveTo(w * 0.1033, h * 0.108);
	c.lineTo(w * 0.24, h * 0.286);
	c.lineTo(w * 0.2317, h * 0.298);
	c.lineTo(w * 0.095, h * 0.12);
	c.close();
	c.fillAndStroke();

	c.rect(w * 0.44, h * 0.128, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.485, h * 0.128, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.53, h * 0.128, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.44, h * 0.186, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.485, h * 0.186, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.53, h * 0.186, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.44, h * 0.244, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.485, h * 0.244, w * 0.033, h * 0.04);
	c.fill();
	c.rect(w * 0.53, h * 0.244, w * 0.033, h * 0.04);
	c.fill();

	c.begin();
	c.moveTo(w * 0.7567, h * 0.18);
	c.lineTo(w * 0.785, h * 0.18);
	c.lineTo(w * 0.825, h * 0.128);
	c.lineTo(w * 0.825, h * 0.28);
	c.lineTo(w * 0.79, h * 0.234);
	c.lineTo(w * 0.7567, h * 0.234);
	c.close();
	c.fill();

	c.setStrokeWidth(1.5);
	c.setStrokeColor('#ffffff');
	c.begin();
	c.moveTo(w * 0.8383, h * 0.16);
	c.arcTo(w * 0.0533, h * 0.064, 0, 0, 1, w * 0.8383, h * 0.252);
	c.moveTo(w * 0.8583, h * 0.134);
	c.arcTo(w * 0.0817, h * 0.098, 0, 0, 1, w * 0.8583, h * 0.276);
	c.moveTo(w * 0.8767, h * 0.11);
	c.arcTo(w * 0.1133, h * 0.136, 0, 0, 1, w * 0.8767, h * 0.304);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.1467, h * 0.62);
	c.lineTo(w * 0.1833, h * 0.62);
	c.lineTo(w * 0.1833,h * 0.676);
	c.lineTo(w * 0.2267,h * 0.676);
	c.lineTo(w * 0.2267,h * 0.724);
	c.lineTo(w * 0.1833,h * 0.724);
	c.lineTo(w * 0.1833,h * 0.78);
	c.lineTo(w * 0.1467,h * 0.78);
	c.lineTo(w * 0.1467,h * 0.724);
	c.lineTo(w * 0.105,h * 0.724);
	c.lineTo(w * 0.105,h * 0.676);
	c.lineTo(w * 0.1467,h * 0.676);
	c.close();
	c.fill();

	c.rect(w * 0.4517, h * 0.624, w * 0.0333, h * 0.152);
	c.fill();

	c.rect(w * 0.5183, h * 0.624, w * 0.0333, h * 0.152);
	c.fill();

	c.begin();
	c.moveTo(w * 0.76, h * 0.752);
	c.arcTo(w * 0.1, h * 0.12, 0, 0, 1, w * 0.8033, h * 0.728);
	c.arcTo(w * 0.0167, h * 0.02, 0, 0, 0, w * 0.8167, h * 0.712);
	c.lineTo(w * 0.8175, h * 0.7);
	c.arcTo(w * 0.0267, h * 0.06, 0, 0, 1, w * 0.8067, h * 0.644);
	c.arcTo(w * 0.0287, h * 0.0344, 0, 0, 1, w * 0.8633, h * 0.644);
	c.arcTo(w * 0.0267, h * 0.06, 0, 0, 1, w * 0.855, h * 0.7);
	c.arcTo(w * 0.05, h * 0.724, 0, 0, 1, w * 0.8633, h * 0.724);
	c.arcTo(w * 0.1667, h * 0.75, 0, 0, 1, w * 0.9083, h * 0.75);
	c.lineTo(w * 0.9083, h * 0.78);
	c.lineTo(w * 0.76, h * 0.78);
	c.close();
	c.fill();

	c.setFontColor('#ffffff');
	c.setFontSize(8.5);
	c.text(w * 0.1667, h * 0.35, 0, 0, 'mute', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.35, 0, 0, 'keypad', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.35, 0, 0, 'speaker', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.1667, h * 0.85, 0, 0, 'add', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.85, 0, 0, 'pause', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.85, 0, 0, 'contacts', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setGradient('#808080', '#ffffff', 0, 0, w, h * 0.308, mxConstants.DIRECTION_NORTH, 1, 1);
	c.setAlpha(0.4);
	c.begin();
	c.moveTo(0, h * 0.308);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h * 0.308);
	c.arcTo(w * 1.5, h * 1.8, 0, 0, 1, 0, h * 0.308);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICALL_DIALOG, mxShapeMockupiCallDialog);

//**********************************************************************************************************************************************************
//Call Buttons
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCallButtons(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCallButtons, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCallButtons.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiCallButtons.prototype.background = function(c, x, y, w, h)
{
	c.setStrokeWidth(0.5);
	c.setStrokeColor('#008cff');
	c.setGradient('#0F1B2B', '#4F5B6B', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
	c.rect(0, 0, w, h);
	c.fillAndStroke();
};

mxShapeMockupiCallButtons.prototype.foreground = function(c, x, y, w, h)
{
	c.begin();
	c.moveTo(0, h * 0.1667);
	c.lineTo(w, h * 0.1667);
	c.moveTo(0, h * 0.3333);
	c.lineTo(w, h * 0.3333);
	c.moveTo(0, h * 0.5);
	c.lineTo(w, h * 0.5);
	c.moveTo(0, h * 0.6667);
	c.lineTo(w, h * 0.6667);
	c.moveTo(0, h * 0.8333);
	c.lineTo(w, h * 0.8333);
	c.moveTo(w * 0.3333, h * 0.1667);
	c.lineTo(w * 0.3333, h);
	c.moveTo(w * 0.6667, h * 0.1667);
	c.lineTo(w * 0.6667, h);
	c.stroke();

	c.setFontSize(15.5);
	c.setFontColor('#ffffff');
	c.setFontStyle(mxConstants.FONT_BOLD);

	c.text(w * 0.5, h * 0.0834, 0, 0, '(123) 456-7890', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.1667, h * 0.22, 0, 0, '1', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.22, 0, 0, '2', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.22, 0, 0, '3', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.1667, h * 0.3867, 0, 0, '3', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.3867, 0, 0, '4', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.3867, 0, 0, '5', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.1667, h * 0.5534, 0, 0, '6', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.5534, 0, 0, '7', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.5534, 0, 0, '8', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontSize(27.5);
	c.text(w * 0.1667, h * 0.76, 0, 0, '*', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.setFontSize(15.5);
	c.text(w * 0.5, h * 0.72, 0, 0, '0', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.75, 0, 0, '#', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setGradient('#E2FFEB', '#008215', w * 0.3333, h * 0.8333, w * 0.3333, h * 0.1667, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.rect(w * 0.3333, h * 0.8333, w * 0.3333, h * 0.1667);
	c.fillAndStroke();

	c.text(w * 0.5, h * 0.9168, 0, 0, 'Call', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFontStyle(0);
	c.setFontSize(8);
	c.setFontColor('#bbbbbb');

	c.text(w * 0.5, h * 0.28, 0, 0, 'ABC', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.28, 0, 0, 'DEF', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.1667, h * 0.4467, 0, 0, 'GHI', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.4467, 0, 0, 'JKL', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.4467, 0, 0, 'MNO', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.1667, h * 0.6134, 0, 0, 'PQRS', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.6134, 0, 0, 'TUV', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.8333, h * 0.6134, 0, 0, 'WXYZ', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.text(w * 0.5, h * 0.78, 0, 0, '+', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setFillColor('#ffffff');
	c.begin();
	c.moveTo(w * 0.1028, h * 0.9464);
	c.arcTo(w * 0.0862, h * 0.0652, 0, 0, 1, w * 0.1402, h * 0.9333);
	c.arcTo(w * 0.0144, h * 0.0109, 0, 0, 0, w * 0.1517, h * 0.9246);
	c.lineTo(w * 0.1524, h * 0.9181);
	c.arcTo(w * 0.023, h * 0.0326, 0, 0, 1, w * 0.143, h * 0.8877);
	c.arcTo(w * 0.0247, h * 0.0187, 0, 0, 1, w * 0.1919, h * 0.8877);
	c.arcTo(w * 0.023, h * 0.0326, 0, 0, 1, w * 0.1847, h * 0.9181);
	c.arcTo(w * 0.0431, h * 0.0174, 0, 0, 0, w * 0.1919, h * 0.9311);
	c.arcTo(w * 0.1437, h * 0.1087, 0, 0, 1, w * 0.2307, h * 0.9453);
	c.lineTo(w * 0.2307, h * 0.9616);
	c.lineTo(w * 0.1028, h * 0.9616);
	c.close();
	c.fill();

	c.setStrokeColor('#ffffff');
	c.setStrokeWidth(2.5);
	c.setLineJoin('round');
	c.begin();
	c.moveTo(w * 0.79, h * 0.89);
	c.lineTo(w * 0.9, h * 0.89);
	c.lineTo(w * 0.9, h * 0.95);
	c.lineTo(w * 0.79, h * 0.95);
	c.lineTo(w * 0.76, h * 0.92);
	c.close();
	c.fillAndStroke();

	c.setStrokeColor('#0F1B2B');
	c.begin();
	c.moveTo(w * 0.82, h * 0.907);
	c.lineTo(w * 0.85, h * 0.933);
	c.moveTo(w * 0.82, h * 0.933);
	c.lineTo(w * 0.85, h * 0.907);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICALL_BUTTONS, mxShapeMockupiCallButtons);

//**********************************************************************************************************************************************************
//Option
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiOption(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiOption, mxShape);

mxShapeMockupiOption.prototype.customProperties = [
	{name: 'buttonText', dispName: 'Text', type: 'string'},
	{name: 'barPos', dispName: 'Callout Position', type: 'float', min:0, defVal:80},
	{name: 'pointerPos', dispName: 'Callout Orientation', type: 'enum',
		enumList: [{val: 'bottom', dispName: 'Bottom'}, {val: 'top', dispName: 'Top'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiOption.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	this.background(c, x, y, w, h);
	c.setShadow(false);
	this.foreground(c, x, y, w, h);
};

mxShapeMockupiOption.prototype.background = function(c, x, y, w, h)
{
	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var pointerPos = mxUtils.getValue(this.style, mxMockupC.POINTER_POS, mxMockupC.POINTER_BOTTOM);
	var rSize = 2.5;
	var deadzone = rSize + 7.5; // rounding + pointer width / 2 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;
	c.setStrokeWidth(0.5);
	c.setStrokeColor('#000000');
	c.setAlpha(0.9);
	c.begin();

	if (pointerPos === mxMockupC.POINTER_BOTTOM)
	{
		c.setGradient('#000000', '#888888', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
		c.moveTo(0, rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
		c.lineTo(w - rSize, 0);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
		c.lineTo(w, h - rSize - 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h - 7.5);
		c.lineTo(truePos + 7.5, h - 7.5);
		c.lineTo(truePos, h);
		c.lineTo(truePos - 7.5, h - 7.5);
		c.lineTo(rSize, h - 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize - 7.5);
	}
	else if (pointerPos === mxMockupC.POINTER_TOP)
	{
		c.setGradient('#000000', '#888888', 0, 0, w, h, mxConstants.DIRECTION_NORTH, 1, 1);
		c.moveTo(0, rSize + 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, rSize, 7.5);
		c.lineTo(truePos - 7.5, 7.5);
		c.lineTo(truePos, 0);
		c.lineTo(truePos + 7.5, 7.5);
		c.lineTo(w - rSize, 7.5);
		c.arcTo(rSize, rSize, 0, 0, 1, w, rSize + 7.5);
		c.lineTo(w, h - rSize);
		c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h);
		c.lineTo(rSize, h);
		c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize);
	}

	c.close();
	c.fillAndStroke();
};

mxShapeMockupiOption.prototype.foreground = function(c, x, y, w, h)
{
	var locText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, 'Some Location');
	var pointerPos = mxUtils.getValue(this.style, mxMockupC.POINTER_POS, mxMockupC.POINTER_BOTTOM);
	c.setAlpha(1);
	c.setFontColor('#ffffff');
	c.setFontSize(9.5);
	
	if (pointerPos === mxMockupC.POINTER_BOTTOM)
	{
		c.text(w * 0.5, (h - 7.5) * 0.5, 0, 0, locText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
	else
	{
		c.text(w * 0.5, (h + 7.5) * 0.5, 0, 0, locText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	}
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IOPTION, mxShapeMockupiOption);

//**********************************************************************************************************************************************************
//Alpha List
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiAlphaList(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiAlphaList, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiAlphaList.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8');

	c.setFontColor('#999999');
	c.setFontSize(fontSize);
	c.text(w * 0.5, h * 0.069, 0, 0, 'A', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.1035, 0, 0, 'B', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.138, 0, 0, 'C', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.1725, 0, 0, 'D', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.207, 0, 0, 'E', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.2415, 0, 0, 'F', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.276, 0, 0, 'G', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.3105, 0, 0, 'H', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.345, 0, 0, 'I', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.3795, 0, 0, 'J', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.414, 0, 0, 'K', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.4485, 0, 0, 'L', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.483, 0, 0, 'M', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.5175, 0, 0, 'N', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.552, 0, 0, 'O', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.5865, 0, 0, 'P', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.621, 0, 0, 'Q', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.6555, 0, 0, 'R', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.69, 0, 0, 'S', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.7245, 0, 0, 'T', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.759, 0, 0, 'U', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.7935, 0, 0, 'V', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.828, 0, 0, 'W', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.8625, 0, 0, 'X', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.897, 0, 0, 'Y', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.9315, 0, 0, 'Z', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.text(w * 0.5, h * 0.966, 0, 0, '#', mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	c.setStrokeColor('#999999');
	c.ellipse(w * 0.5 - 2.25, h * 0.0345 - 3.5, 4.5, 4.5);
	c.stroke();

	c.begin();
	c.moveTo(w * 0.5 - 4.25, h * 0.0345 + 3);
	c.lineTo(w * 0.5 - 1.75, h * 0.0345);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IALPHA_LIST, mxShapeMockupiAlphaList);

//**********************************************************************************************************************************************************
//Horizontal Button Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiHorButtonBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiHorButtonBar, mxShape);

mxShapeMockupiHorButtonBar.prototype.customProperties = [
	{name: 'buttonText', dispName: 'Labels', type: 'string'},
	{name: 'textColor', dispName: 'Text Color', type: 'color'},
	{name: 'textColor2', dispName: 'Text2 Color', type: 'color'},
	{name: 'strokeColor2', dispName: 'Stroke2 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiHorButtonBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var textStrings = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '+Button 1, Button 2, Button 3').toString().split(',');
	var fontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR, '#666666');
	var selectedFontColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR2, '#ffffff');
	var fontSize = mxUtils.getValue(this.style, mxConstants.STYLE_FONTSIZE, '8.5').toString();
	var frameColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#666666');
	var separatorColor = mxUtils.getValue(this.style, mxMockupC.STYLE_STROKECOLOR2, '#c4c4c4');
	var bgColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var selectedFillColor = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '#008cff');
	var buttonNum = textStrings.length;
	var buttonWidths = new Array(buttonNum);
	var buttonTotalWidth = 0;
	var selectedButton = -1;
	var rSize = 2.5; //rounding size
	var labelOffset = 2.5;

	for (var i = 0; i < buttonNum; i++)
	{
		var buttonText = textStrings[i];

		if(buttonText.charAt(0) === mxMockupC.SELECTED)
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

mxShapeMockupiHorButtonBar.prototype.background = function(c, w, h, rSize, buttonNum, buttonWidths, labelOffset, minW, frameColor, separatorColor, bgColor, selectedFillColor, selectedButton)
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
	c.setStrokeColor(mxConstants.NONE);

	for (var i = 0; i < selectedButton; i++)
	{
		buttonLeft += buttonWidths[i] + 2 * labelOffset;
	}

	buttonLeft = buttonLeft * w / minW;
	var buttonRight = (buttonWidths[selectedButton] + 2 * labelOffset) * w / minW;
	buttonRight += buttonLeft;

	if (selectedButton === 0)
	{
		c.setGradient('#5D7585', '#008cff', 0, 0, buttonRight, h, mxConstants.DIRECTION_SOUTH, 1, 1);
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
		c.setGradient('#5D7585', '#008cff', buttonLeft, 0, buttonRight - buttonLeft, h, mxConstants.DIRECTION_SOUTH, 1, 1);
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
		c.setGradient('#5D7585', '#008cff', buttonLeft, 0, buttonRight - buttonLeft, h, mxConstants.DIRECTION_SOUTH, 1, 1);
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

mxShapeMockupiHorButtonBar.prototype.buttonText = function(c, w, h, textString, buttonWidth, fontSize, minW, trueW)
{
	if(textString.charAt(0) === mxMockupC.SELECTED)
	{
		textString = textString.substring(1);
	}

	c.begin();
	c.setFontSize(fontSize);
	c.text((w + buttonWidth * 0.5) * trueW / minW, h * 0.5, 0, 0, textString, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IHOR_BUTTON_BAR, mxShapeMockupiHorButtonBar);

//**********************************************************************************************************************************************************
//Pin
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiPin(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiPin, mxShape);

mxShapeMockupiPin.prototype.customProperties = [
	{name: 'fillColor2', dispName: 'Fill2 Color', type: 'color'},
	{name: 'fillColor3', dispName: 'Fill3 Color', type: 'color'}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiPin.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '#000000');
	var fillColor3 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR3, '#000000');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setShadow(false);
	c.translate(x, y);

	c.setStrokeWidth(1.5);
	c.setStrokeColor('#666666');
	c.begin();
	c.moveTo(w * 0.5, h * 0.4);
	c.lineTo(w * 0.5, h);
	c.stroke();

	c.setStrokeWidth(1);
	c.setStrokeColor(strokeColor);
	c.setGradient(fillColor2, fillColor3, 0, 0, w, h * 0.4, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.9);
	c.ellipse(0, 0, w, h * 0.4);
	c.fillAndStroke();

	c.setFillColor('#ffffff');
	c.setAlpha(0.5);
	c.ellipse(w * 0.2, h * 0.08, w * 0.3, h * 0.12);
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPIN, mxShapeMockupiPin);

//**********************************************************************************************************************************************************
//Video Controls
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiVideoControls(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiVideoControls, mxShape);

mxShapeMockupiVideoControls.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, defVal:20}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiVideoControls.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = 5;
	c.setStrokeWidth(1);
	c.setFillColor('#000000');
	c.setStrokeColor('#bbbbbb');
	c.setAlpha(0.7);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
	c.setShadow(false);

	this.foreground(c, w, h, rSize);
};

mxShapeMockupiVideoControls.prototype.foreground = function(c, w, h, rSize)
{
	c.setGradient('#ffffff', '#ffffff', 0, 0, w, h * 0.5, mxConstants.DIRECTION_SOUTH, 0.8, 0.1);
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h * 0.5);
	c.lineTo(0, h * 0.5);
	c.close();
	c.fill();

	c.setAlpha(1);
	c.setFillColor('#ffffff');
	c.setStrokeColor('#ffffff');
	var iconX = w * 0.1;
	var iconY = h * 0.35;

	c.begin();
	c.moveTo(iconX - 7.5, iconY - 2.5);
	c.arcTo(6, 6, 0, 0, 1, iconX, iconY - 2.5);
	c.arcTo(6, 6, 0, 0, 1, iconX + 7.5, iconY - 2.5);
	c.lineTo(iconX + 7.5, iconY + 4);
	c.arcTo(6, 6, 0, 0, 0, iconX, iconY + 4);
	c.arcTo(6, 6, 0, 0, 0, iconX - 7.5, iconY + 4);
	c.close();
	c.stroke();

	c.begin();
	c.moveTo(iconX, iconY - 2.5);
	c.lineTo(iconX, iconY + 4);
	c.stroke();

	iconX = w * 0.3;
	c.rect(iconX - 7.5, iconY - 5, 1, 10);
	c.fill();

	c.begin();
	c.moveTo(iconX - 6.5, iconY);
	c.lineTo(iconX + 0.5, iconY - 5);
	c.lineTo(iconX + 0.5, iconY + 5);
	c.close();
	c.fill();

	c.begin();
	c.moveTo(iconX + 0.5, iconY);
	c.lineTo(iconX + 7.5, iconY - 5);
	c.lineTo(iconX + 7.5, iconY + 5);
	c.close();
	c.fill();

	iconX = w * 0.5;
	c.begin();
	c.moveTo(iconX - 6, iconY - 5);
	c.lineTo(iconX + 6, iconY);
	c.lineTo(iconX - 6, iconY + 5);
	c.close();
	c.fill();

	iconX = w * 0.7;
	c.begin();
	c.moveTo(iconX - 7.5, iconY - 5);
	c.lineTo(iconX - 0.5, iconY);
	c.lineTo(iconX - 7.5, iconY + 5);
	c.close();
	c.fill();
	c.begin();
	c.moveTo(iconX - 0.5, iconY - 5);
	c.lineTo(iconX + 6.5, iconY);
	c.lineTo(iconX - 0.5, iconY + 5);
	c.close();
	c.fill();
	c.rect(iconX + 6.5, iconY - 5, 1, 10);
	c.fill();

	iconX = w * 0.9;
	c.rect(iconX - 7.5, iconY - 4, 15, 8);
	c.stroke();
	c.setStrokeWidth(0.5);
	c.begin();
	c.moveTo(iconX - 7.5, iconY - 4);
	c.lineTo(iconX, iconY + 1.5);
	c.lineTo(iconX + 7.5, iconY - 4);
	c.stroke();
	c.begin();
	c.moveTo(iconX - 7.5, iconY + 4);
	c.lineTo(iconX - 2, iconY);
	c.stroke();
	c.begin();
	c.moveTo(iconX + 7.5, iconY + 4);
	c.lineTo(iconX + 2, iconY);
	c.stroke();

	c.setGradient('#444444', '#ffffff', w * 0.1, h * 0.75 - 2.5, w * 0.8, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(w * 0.1, h * 0.75 - 2.5, w * 0.8, 5, 2.5, 2.5);
	c.fill();

	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = w * 0.1; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setGradient('#96D1FF', '#003377', w * 0.1, h * 0.75 - 5, truePos - w * 0.1, 10, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(truePos, h * 0.75 - 2.5);
	c.lineTo(truePos, h * 0.75 + 2.5);
	c.lineTo(w * 0.1 + 2.5, h * 0.75 + 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, w * 0.1 + 2.5, h * 0.75 - 2.5);
	c.close();
	c.fill();

	c.setStrokeColor('#999999');
	c.setGradient('#444444', '#ffffff', truePos - 5, h * 0.75 - 5, 10, 10, mxConstants.DIRECTION_NORTH, 1, 1);
	c.ellipse(truePos - 5, h * 0.75 - 5, 10, 10);
	c.fillAndStroke();

	c.setStrokeColor('#dddddd');
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IVIDEO_CONTROLS, mxShapeMockupiVideoControls);

Graph.handleFactory[mxMockupC.SHAPE_IVIDEO_CONTROLS] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 40))));

				return new mxPoint(bounds.x + bounds.width * 0.1 + barPos * bounds.width * 0.8 / 100, bounds.y + bounds.height * 0.75);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.width * 0.1 - bounds.x) * 100 / (bounds.width * 0.8)))) / 100;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//URL Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiURLBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiURLBar, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiURLBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.setGradient('#cccccc', '#003377', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.rect(0, 0, w, h);
	c.fill();
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeMockupiURLBar.prototype.foreground = function(c, w, h)
{
	c.setStrokeWidth(0.5);
	c.setFillColor('#ffffff');
	c.setStrokeColor('#008cff');
	c.roundrect(w * 0.0287, h * 0.625 - 6.25, w * 0.7184, 12.5, 6.25, 6.25);
	c.fillAndStroke();

	c.setGradient('#cccccc', '#001144', w * 0.7816, h * 0.625 - 6.25, w * 0.1868, 12.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setStrokeColor('#000000');
	c.roundrect(w * 0.7816, h * 0.625 - 6.25, w * 0.1868, 12.5, 2.5, 2.5);
	c.fillAndStroke();

	c.setFillColor('#bbbbbb');
	c.ellipse(w * 0.7471 - 11.5, h * 0.625 - 5, 10, 10);
	c.fill();

	c.setStrokeColor('#ffffff');
	c.setStrokeWidth(1.5);
	c.begin();
	c.moveTo(w * 0.7471 - 8.5, h * 0.625 - 2.5);
	c.lineTo(w * 0.7471 - 3.5, h * 0.625 + 2.5);
	c.moveTo(w * 0.7471 - 8.5, h * 0.625 + 2.5);
	c.lineTo(w * 0.7471 - 3.5, h * 0.625 - 2.5);
	c.stroke();

	var fieldText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '').toString().split(',');
	c.setFontColor('#425664');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.setFontSize(8);
	c.text(w * 0.5, h * 0.2, 0, 0, fieldText[0], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.setFontColor('#000000');
	c.text(w * 0.06, h * 0.625, 0, 0, fieldText[1], mxConstants.ALIGN_LEFT, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
	c.setFontColor('#ffffff');
	c.text(w * 0.875, h * 0.625, 0, 0, fieldText[2], mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IURL_BAR, mxShapeMockupiURLBar);

//**********************************************************************************************************************************************************
//Slider
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiSlider(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiSlider, mxShape);

mxShapeMockupiSlider.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, defVal:20},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiSlider.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeMockupiSlider.prototype.foreground = function(c, w, h)
{
	c.setStrokeWidth(0.5);
	c.setGradient('#444444', '#ffffff', 0, h * 0.5 - 2.5, w, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(0, h * 0.5 - 2.5, w, 5, 2.5, 2.5);
	c.fill();

	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = 0; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setGradient('#96D1FF', '#003377', 2.5, h * 0.5 - 2.5, truePos - 2.5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(truePos, h * 0.5 - 2.5);
	c.lineTo(truePos, h * 0.5 + 2.5);
	c.lineTo(2.5, h * 0.5 + 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, 2.5, h * 0.5 - 2.5);
	c.close();
	c.fill();

	c.setStrokeColor('#999999');
	c.setGradient('#444444', '#ffffff', truePos - 5, h * 0.5 - 5, 10, 10, mxConstants.DIRECTION_NORTH, 1, 1);
	c.ellipse(truePos - 5, h * 0.5 - 5, 10, 10);
	c.fillAndStroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ISLIDER, mxShapeMockupiSlider);

Graph.handleFactory[mxMockupC.SHAPE_ISLIDER] = function(state)
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


//**********************************************************************************************************************************************************
//Progress Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiProgressBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiProgressBar, mxShape);

mxShapeMockupiProgressBar.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, defVal:40},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiProgressBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeMockupiProgressBar.prototype.foreground = function(c, w, h)
{
	c.setStrokeWidth(0.5);
	c.setGradient('#444444', '#ffffff', 0, h * 0.5 - 2.5, w, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.roundrect(0, h * 0.5 - 2.5, w, 5, 2.5, 2.5);
	c.fill();

	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = 0; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setGradient('#96D1FF', '#003377', 2.5, h * 0.5 - 2.5, truePos - 2.5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.begin();
	c.moveTo(truePos, h * 0.5 - 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, truePos, h * 0.5 + 2.5);
	c.lineTo(2.5, h * 0.5 + 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, 2.5, h * 0.5 - 2.5);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPROGRESS_BAR, mxShapeMockupiProgressBar);

Graph.handleFactory[mxMockupC.SHAPE_IPROGRESS_BAR] = function(state)
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

//**********************************************************************************************************************************************************
//iCloud Progress Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCloudProgressBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCloudProgressBar, mxShape);

mxShapeMockupiCloudProgressBar.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, defVal:20},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCloudProgressBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeMockupiCloudProgressBar.prototype.foreground = function(c, w, h)
{
	c.setStrokeWidth(0.5);
	c.setFillColor('#5C6E86');
	c.rect(0, h * 0.5 - 2.5, w, 5);
	c.fill();

	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = 0; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setFillColor('#8AD155');
	c.rect(0, h * 0.5 - 2.5, truePos, 5);
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICLOUD_PROGRESS_BAR, mxShapeMockupiCloudProgressBar);

Graph.handleFactory[mxMockupC.SHAPE_ICLOUD_PROGRESS_BAR] = function(state)
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

//**********************************************************************************************************************************************************
//Download Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiDownloadBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiDownloadBar, mxShape);

mxShapeMockupiDownloadBar.prototype.customProperties = [
	{name: 'barPos', dispName: 'Handle Position', type: 'float', min:0, defVal:30},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiDownloadBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	c.setGradient('#00ccff', '#0066cc', 0, 0, w, h, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.rect(0, 0, w, h);
	c.fill();
	c.setShadow(false);

	this.foreground(c, w, h);
};

mxShapeMockupiDownloadBar.prototype.foreground = function(c, w, h)
{
	var fieldText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '');
	c.setFontColor('#ffffff');
	c.setFontStyle(mxConstants.FONT_BOLD);
	c.setFontSize(8);
	c.text(w * 0.5, h * 0.2, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);

	var barPos = mxUtils.getValue(this.style, mxMockupC.BAR_POS, '80');
	barPos = Math.min(barPos, 100);
	barPos = Math.max(barPos, 0);
	var deadzone = w * 0.1; 
	var virRange = w - 2 * deadzone;
	var truePos = deadzone + virRange * barPos / 100;

	c.setStrokeWidth(0.5);
	c.setGradient('#96D1FF', '#003377', deadzone, h * 0.65 - 2.5, w - 2 * deadzone, 5, mxConstants.DIRECTION_NORTH, 1, 1);
	c.roundrect(deadzone, h * 0.65 - 2.5, w - 2 * deadzone, 5, 2.5, 2.5);
	c.fill();

	c.setGradient('#aaaaaa', '#ffffff', deadzone + 2.5, h * 0.65 - 2.5, truePos - deadzone - 2.5, 5, mxConstants.DIRECTION_NORTH, 1, 1);
	c.begin();
	c.moveTo(truePos, h * 0.65 - 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, truePos, h * 0.65 + 2.5);
	c.lineTo(deadzone + 2.5, h * 0.65 + 2.5);
	c.arcTo(2.5, 2.5, 0, 0, 1, deadzone + 2.5, h * 0.65 - 2.5);
	c.close();
	c.fill();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IDOWNLOAD_BAR, mxShapeMockupiDownloadBar);

Graph.handleFactory[mxMockupC.SHAPE_IDOWNLOAD_BAR] = function(state)
{
	var handles = [Graph.createHandle(state, ['barPos'], function(bounds)
			{
				var barPos = Math.max(0, Math.min(bounds.width, parseFloat(mxUtils.getValue(this.state.style, 'barPos', 40))));

				return new mxPoint(bounds.x + bounds.width * 0.1 + barPos * bounds.width * 0.8 / 100, bounds.y + bounds.height * 0.65);
			}, function(bounds, pt)
			{
				this.state.style['barPos'] = Math.round(100 * Math.max(0, Math.min(100, (pt.x - bounds.width * 0.1 - bounds.x) * 100 / (bounds.width * 0.8)))) / 100;
			})];
			
	return handles;
};

//**********************************************************************************************************************************************************
//Screen Name Bar
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiScreenNameBar(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiScreenNameBar, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiScreenNameBar.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var rSize = 5;
	c.setStrokeWidth(0.5);
	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '#00ff00');
	c.setFillColor(fillColor2);
	c.rect(0, 0, w, h);
	c.fill();
	c.setShadow(false);

	this.foreground(c, w, h, rSize);
};

mxShapeMockupiScreenNameBar.prototype.foreground = function(c, w, h, rSize)
{
	var fillColor3 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR3, '#00ff00');
	c.setGradient(fillColor3, fillColor3, 0, 0, w, h * 0.5, mxConstants.DIRECTION_SOUTH, 0.8, 0.1);
	c.rect(0, 0, w, h * 0.5);
	c.fill();

	var fieldText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '');
	var textColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR, '#00ff00');
	c.setFontColor(textColor);
	c.setFontSize(9.5);
	c.text(w * 0.5, h * 0.45, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ISCREEN_NAME_BAR, mxShapeMockupiScreenNameBar);

//**********************************************************************************************************************************************************
//Icon Grid
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiIconGrid(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiIconGrid, mxShape);

mxShapeMockupiIconGrid.prototype.customProperties = [
	{name: 'gridSize', dispName: 'Grid Size', type: 'string'},
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiIconGrid.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);
	var gridSize = mxUtils.getValue(this.style, mxMockupC.GRID_SIZE, '3,3').toString().split(',');
	this.background(c, w, h, gridSize);
	c.setShadow(false);

	this.foreground(c, w, h, gridSize);
};

mxShapeMockupiIconGrid.prototype.background = function(c, w, h, gridSize)
{
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#00ff00');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#00ff00');
	c.setStrokeColor(strokeColor);
	c.setFillColor(fillColor);

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

mxShapeMockupiIconGrid.prototype.foreground = function(c, w, h, gridSize)
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

mxCellRenderer.registerShape(mxMockupC.SHAPE_IICON_GRID, mxShapeMockupiIconGrid);

//**********************************************************************************************************************************************************
//Copy
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCopy(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCopy, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCopy.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var rSize = 5;
	c.translate(x, y);
	this.background(c, w, h, rSize);
	c.setShadow(false);

	this.foreground(c, w, h, rSize);
};

mxShapeMockupiCopy.prototype.background = function(c, w, h, rSize)
{
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h - rSize - 7.5);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize, h - 7.5);
	c.lineTo(w * 0.5 + 7.5, h - 7.5);
	c.lineTo(w * 0.5, h);
	c.lineTo(w * 0.5 - 7.5, h - 7.5);
	c.lineTo(rSize, h - 7.5);
	c.arcTo(rSize, rSize, 0, 0, 1, 0, h - rSize - 7.5);
	c.close();
	c.fillAndStroke();
};

mxShapeMockupiCopy.prototype.foreground = function(c, w, h, rSize)
{
	var fillColor3 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR3, '#00ff00');
	c.setGradient(fillColor3, fillColor3, 0, 0, w, h * 0.5, mxConstants.DIRECTION_SOUTH, 0.8, 0.1);
	c.begin();
	c.moveTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, (h - 7.5) * 0.5);
	c.lineTo(0, (h - 7.5) * 0.5);
	c.close();
	c.fill();

	var fieldText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '');
	var textColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR, '#00ff00');
	c.setFontColor(textColor);
	c.setFontSize(8.5);
	c.text(w * 0.5, (h - 7.5)* 0.45, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICOPY, mxShapeMockupiCopy);

//**********************************************************************************************************************************************************
//Copy Area
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiCopyArea(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiCopyArea, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiCopyArea.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var rSize = 5;
	c.translate(x, y);
	this.background(c, w, h, rSize);
	c.setShadow(false);

	this.foreground(c, w, h, rSize);
};

mxShapeMockupiCopyArea.prototype.background = function(c, w, h, rSize)
{
	c.begin();
	c.moveTo(w * 0.5 - 20, 0 + rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 - 20 + rSize, 0);
	c.lineTo(w * 0.5 + 20 - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 + 20, rSize);
	c.lineTo(w * 0.5 + 20, 20 - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 + 20 - rSize, 20);
	c.lineTo(w * 0.5 + 7.5, 20);
	c.lineTo(w * 0.5, 27.5);
	c.lineTo(w * 0.5 - 7.5, 20);
	c.lineTo(w * 0.5 - 20 + rSize, 20);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 - 20, 20 - rSize);
	c.close();
	c.fillAndStroke();
};

mxShapeMockupiCopyArea.prototype.foreground = function(c, w, h, rSize)
{
	c.setAlpha(0.3);
	c.setFillColor('#2266ff');
	c.rect(2.5, 27.5, w - 5, h - 30);
	c.fill();
	c.setAlpha(1);

	if (h > 27.5)
	{
		c.setStrokeColor('#ffffff');
		c.setGradient('#88ddff', '#2266ff', w * 0.5 - 2.5, 25, 5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(w * 0.5 - 2.5, 25, 5, 5);
		c.fillAndStroke();
		c.setGradient('#88ddff', '#2266ff', w * 0.5 - 2.5, h - 5, 5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(w * 0.5 - 2.5, h - 5, 5, 5);
		c.fillAndStroke();
		c.setGradient('#88ddff', '#2266ff', 0, h * 0.5 + 10, 5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(0, h * 0.5 + 10, 5, 5);
		c.fillAndStroke();
		c.setGradient('#88ddff', '#2266ff', w - 5, h * 0.5 + 10, 5, 5, mxConstants.DIRECTION_SOUTH, 1, 1);
		c.ellipse(w - 5, h * 0.5 + 10, 5, 5);
		c.fillAndStroke();
	}

	var fillColor2 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR2, '#00ff00');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#00ff00');

	c.setFillColor(fillColor2);
	c.setStrokeColor(strokeColor);
	c.begin();
	c.moveTo(w * 0.5 - 20, 0 + rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 - 20 + rSize, 0);
	c.lineTo(w * 0.5 + 20 - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 + 20, rSize);
	c.lineTo(w * 0.5 + 20, 20 - rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 + 20 - rSize, 20);
	c.lineTo(w * 0.5 + 7.5, 20);
	c.lineTo(w * 0.5, 27.5);
	c.lineTo(w * 0.5 - 7.5, 20);
	c.lineTo(w * 0.5 - 20 + rSize, 20);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 - 20, 20 - rSize);
	c.close();
	c.fillAndStroke();

	var fillColor3 = mxUtils.getValue(this.style, mxMockupC.STYLE_FILLCOLOR3, '#00ff00');
	c.setGradient(fillColor3, fillColor3, w * 0.5 - 20, 0, 40, 10, mxConstants.DIRECTION_SOUTH, 0.8, 0.1);
	c.begin();
	c.moveTo(w * 0.5 - 20, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 - 20 + rSize, 0);
	c.lineTo(w * 0.5 + 20 - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w * 0.5 + 20, rSize);
	c.lineTo(w * 0.5 + 20, 10);
	c.lineTo(w * 0.5 - 20, 10);
	c.close();
	c.fill();

	var fieldText = mxUtils.getValue(this.style, mxMockupC.BUTTON_TEXT, '');
	var textColor = mxUtils.getValue(this.style, mxMockupC.STYLE_TEXTCOLOR, '#00ff00');
	c.setFontColor(textColor);
	c.setFontSize(8.5);

	c.text(w * 0.5, 8.75, 0, 0, fieldText, mxConstants.ALIGN_CENTER, mxConstants.ALIGN_MIDDLE, 0, null, 0, 0, 0);
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_ICOPY_AREA, mxShapeMockupiCopyArea);

//**********************************************************************************************************************************************************
//Home Page Control
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiHomePageControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiHomePageControl, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiHomePageControl.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);


	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#000000');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');
	c.setStrokeColor(strokeColor);
	c.setFillColor(fillColor);

	var rSize = Math.min(h * 0.5, w * 0.05);
	c.ellipse(w * 0.35 - rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w * 0.65 - rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();
	c.ellipse(w - 2 * rSize, h * 0.5 - rSize, 2 * rSize, 2 * rSize);
	c.fill();

	c.ellipse(rSize * 0.2, h * 0.5 - rSize * 0.8, rSize * 1.2, rSize * 1.2);
	c.stroke();
	c.begin();
	c.moveTo(rSize * 1.15, h * 0.5 + rSize * 0.25);
	c.lineTo(rSize * 1.6, h * 0.5 + rSize * 0.8);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IHOME_PAGE_CONTROL, mxShapeMockupiHomePageControl);

//**********************************************************************************************************************************************************
//Page Control
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiPageControl(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiPageControl, mxShape);

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiPageControl.prototype.paintVertexShape = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPAGE_CONTROL, mxShapeMockupiPageControl);

//**********************************************************************************************************************************************************
//iPad
//**********************************************************************************************************************************************************
/**
 * Extends mxShape.
 */
function mxShapeMockupiPad(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupiPad, mxShape);

mxShapeMockupiPad.prototype.customProperties = [
	{name: 'bgStyle', dispName: 'Background', type: 'enum', 
		enumList: [{val: 'bgGreen', dispName: 'Green'}, {val: 'bgWhite', dispName: 'White'}, {val: 'bgGray', dispName: 'Gray'}, {val: 'bgFlat', dispName: 'Flat'}, {val: 'bgMap', dispName: 'Map'}, {val: 'bgStriped', dispName: 'Striped'}]
	}
];

/**
 * Function: paintVertexShape
 * 
 * Paints the vertex shape.
 */
mxShapeMockupiPad.prototype.paintVertexShape = function(c, x, y, w, h)
{
	var rSize = 25;
	c.translate(x, y);
	this.background(c, x, y, w, h, rSize);
	c.setShadow(false);
	this.foreground(c, x, y, w, h, rSize);
};

mxShapeMockupiPad.prototype.background = function(c, x, y, w, h, rSize)
{
	c.setFillColor('#000000');
	c.setStrokeColor('#000000');
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.fillAndStroke();
};

mxShapeMockupiPad.prototype.foreground = function(c, x, y, w, h, rSize)
{
	c.setStrokeWidth(1.5);
	c.setStrokeColor('#999999');

	c.begin();
	c.setStrokeColor('none');
	c.setFillColor('#808080');
	c.setGradient('#808080', '#000000', w * 0.325, 0, w * 0.675, h * 0.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.moveTo(w * 0.325, 0);
	c.lineTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, h * 0.5);
	c.lineTo(w * 0.7, h * 0.5);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.setFillColor('#1f2923');
	c.setStrokeColor('#18211b');
	c.setStrokeWidth(1);

	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '');
	var bgStyle = mxUtils.getValue(this.style, mxMockupC.BG_STYLE, mxMockupC.BG_FLAT_GREEN);

	c.setStrokeWidth(1);

	if (bgStyle === mxMockupC.BG_FLAT_WHITE)
	{
		c.setFillColor('#ffffff');
		c.rect(w * 0.0928, h * 0.08, w * 0.8144, h * 0.816);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_GREEN)
	{
		c.setFillColor('#1f2923');
		c.rect(w * 0.0928, h * 0.08, w * 0.8144, h * 0.816);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_GRAY)
	{
		c.setFillColor('#dddddd');
		c.rect(w * 0.0928, h * 0.08, w * 0.8144, h * 0.816);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_FLAT_CUSTOM)
	{
		c.setFillColor(fillColor);
		c.rect(w * 0.0928, h * 0.08, w * 0.8144, h * 0.816);
		c.fill();
	}
	else if (bgStyle === mxMockupC.BG_STRIPED)
	{
		var xOld = x;
		var yOld = y;
		var wOld = w;
		var hOld = h;
		c.translate(w * 0.0928, h * 0.08);
		w = w * 0.8144;
		h = h * 0.816;

		c.setFillColor('#5D7585');
		c.rect(0, 0, w, h);
		c.fillAndStroke();

		var strokeColor = '#18211b';
		var strokeColor2 = '#657E8F';

		c.setStrokeColor(strokeColor2);
		var i = 7;
		c.begin();

		while (i < w)
		{
			c.moveTo(i, 0);
			c.lineTo(i, h);
			i = i + 7;
		}

		c.stroke();

		c.setStrokeColor(strokeColor);
		c.begin();
		c.rect(0, 0, w, h);
		c.stroke();

		w = wOld;
		h = hOld;
		c.translate( - w * 0.0928, - h * 0.08);
	}
	else if (bgStyle === mxMockupC.BG_MAP)
	{
		var xOld = x;
		var yOld = y;
		var wOld = w;
		var hOld = h;
		c.translate(w * 0.0928, h * 0.08);
		w = w * 0.8144;
		h = h * 0.816;

		c.setFillColor('#ffffff');
		c.rect(0, 0, w, h);
		c.fillAndStroke();

		var fillColor2 = '#96D1FF';
		var strokeColor = '#18211b';
		var strokeColor2 = '#008cff';

		c.setFillColor(fillColor2);
		c.setStrokeColor(strokeColor2);
		c.setStrokeWidth(0.5);

		c.begin();
		c.moveTo(0, 0);
		c.lineTo(w * 0.1171, 0);
		c.lineTo(w * 0.1136, h * 0.0438);
		c.lineTo(w * 0.0993, h * 0.054);
		c.lineTo(0, h * 0.0446);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1993, 0);
		c.lineTo(w * 0.1914, h * 0.03884);
		c.lineTo(w * 0.1536, h * 0.0362);
		c.lineTo(w * 0.1586, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.24, 0);
		c.lineTo(w * 0.2257, h * 0.054);
		c.lineTo(w * 0.2414, h * 0.0674);
		c.lineTo(w * 0.4707, h * 0.0835);
		c.lineTo(w * 0.5264, h * 0.0906);
		c.lineTo(w * 0.6429, h * 0.0929);
		c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.7193, h * 0.0621);
		c.arcTo(w * 0.48, h * 0.2143, 0, 0, 0, w * 0.7286, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8, 0);
		c.lineTo(w * 0.7886, h * 0.04554);
		c.arcTo(w * 0.0857, h * 0.0536, 0, 0, 0, w * 0.8164, h * 0.0875);
		c.arcTo(w * 0.1429, h * 0.0893, 0, 0, 0, w * 0.88, h * 0.1036);
		c.lineTo(w, h * 0.1112);
		c.lineTo(w, 0);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.0933);
		c.lineTo(w * 0.08, h * 0.1036);
		c.lineTo(w * 0.1021, h * 0.1246);
		c.lineTo(w * 0.1007, h * 0.1768);
		c.lineTo(w * 0.0471, h * 0.2241);
		c.lineTo(0, h * 0.2527);
		c.close();
		c.fillAndStroke();

		c.ellipse(w * 0.1214, h * 0.0603, w * 0.0843, h * 0.0576);
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1293, h * 0.1924);
		c.lineTo(w * 0.1729, h * 0.142);
		c.lineTo(w * 0.1407, h * 0.1411);
		c.lineTo(w * 0.14, h * 0.1777);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4586, h * 0.1241);
		c.lineTo(w * 0.455, h * 0.1835);
		c.lineTo(w * 0.3893, h * 0.2246);
		c.lineTo(w * 0.2171, h * 0.1362);
		c.lineTo(w * 0.2171, h * 0.1308);
		c.lineTo(w * 0.2293, h * 0.1214);
		c.lineTo(w * 0.2857, h * 0.1174);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5079, h * 0.1134);
		c.lineTo(w * 0.7307, h * 0.1223);
		c.lineTo(w * 0.7279, h * 0.1625);
		c.lineTo(w * 0.715, h * 0.1772);
		c.lineTo(w * 0.6929, h * 0.1688);
		c.lineTo(w * 0.625, h * 0.1795);
		c.lineTo(w * 0.4779, h * 0.2835);
		c.lineTo(w * 0.395, h * 0.2299);
		c.lineTo(w * 0.4657, h * 0.1826);
		c.lineTo(w * 0.4707, h * 0.1223);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.1362);
		c.lineTo(w * 0.7643, h * 0.1237);
		c.lineTo(w * 0.7543, h * 0.1562);
		c.lineTo(w * 0.7643, h * 0.1585);
		c.lineTo(w * 0.9186, h * 0.2366);
		c.lineTo(w, h * 0.1732);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2079, h * 0.1545);
		c.lineTo(w * 0.3886, h * 0.2536);
		c.lineTo(w * 0.3414, h * 0.2933);
		c.lineTo(w * 0.1743, h * 0.1969);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.1579, h * 0.2134);
		c.lineTo(w * 0.3221, h * 0.3067);
		c.lineTo(w * 0.2957, h * 0.3237);
		c.lineTo(w * 0.1157, h * 0.2424);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.405, h * 0.2656);
		c.lineTo(w * 0.31, h * 0.3353);
		c.lineTo(w * 0.3693, h * 0.3661);
		c.lineTo(w * 0.4571, h * 0.2982);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.7121, h * 0.1848);
		c.lineTo(w * 0.6879, h * 0.1754);
		c.lineTo(w * 0.6329, h * 0.1844);
		c.lineTo(w * 0.61, h * 0.2018);
		c.lineTo(w * 0.6207, h * 0.2085);
		c.lineTo(w * 0.4986, h * 0.2982);
		c.lineTo(w * 0.535, h * 0.3237);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5557, h * 0.3379);
		c.lineTo(w * 0.7464, h * 0.1826);
		c.lineTo(w * 0.8036, h * 0.2076);
		c.lineTo(w * 0.595, h * 0.3616);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8293, h * 0.2188);
		c.lineTo(w * 0.8979, h * 0.2509);
		c.lineTo(w * 0.6936, h * 0.4125);
		c.lineTo(w * 0.6171, h * 0.3737);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.2138);
		c.lineTo(w * 0.6821, h * 0.4603);
		c.lineTo(w * 0.815, h * 0.5277);
		c.lineTo(w, h * 0.4);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.317);
		c.lineTo(w * 0.0971, h * 0.2554);
		c.lineTo(w * 0.4121, h * 0.4143);
		c.lineTo(w * 0.3736, h * 0.4415);
		c.lineTo(w * 0.315, h * 0.4076);
		c.lineTo(w * 0.3093, h * 0.4116);
		c.lineTo(w * 0.3686, h * 0.4455);
		c.lineTo(w * 0.285, h * 0.5045);
		c.lineTo(w * 0.1114, h * 0.4134);
		c.lineTo(w * 0.025, h * 0.4603);
		c.lineTo(w * 0.0371, h * 0.4723);
		c.lineTo(w * 0.1114, h * 0.4371);
		c.lineTo(w * 0.2871, h * 0.5312);
		c.lineTo(w * 0.1929, h * 0.6058);
		c.lineTo(w * 0.2271, h * 0.6705);
		c.lineTo(w * 0.17, h * 0.7147);
		c.lineTo(w * 0.0314, h * 0.6321);
		c.lineTo(0, h * 0.6246);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.48, h * 0.3121);
		c.lineTo(w * 0.5157, h * 0.3375);
		c.lineTo(w * 0.4314, h * 0.3982);
		c.lineTo(w * 0.3929, h * 0.3786);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3086, h * 0.5179);
		c.lineTo(w * 0.53, h * 0.3518);
		c.lineTo(w * 0.5757, h * 0.3745);
		c.lineTo(w * 0.3479, h * 0.5411);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.5964, h * 0.3884);
		c.lineTo(w * 0.6736, h * 0.4277);
		c.lineTo(w * 0.445, h * 0.5991);
		c.lineTo(w * 0.3664, h * 0.5531);
		c.lineTo(w * 0.5057, h * 0.4545);
		c.lineTo(w * 0.5507, h * 0.4754);
		c.lineTo(w * 0.5571, h * 0.4723);
		c.lineTo(w * 0.5114, h * 0.4504);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4793, h * 0.6161);
		c.lineTo(w * 0.6771, h * 0.4643);
		c.lineTo(w * 0.8086, h * 0.5326);
		c.lineTo(w * 0.7471, h * 0.5817);
		c.lineTo(w * 0.7214, h * 0.567);
		c.lineTo(w * 0.715, h * 0.571);
		c.lineTo(w * 0.7421, h * 0.5871);
		c.lineTo(w * 0.6014, h * 0.6933);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.4371);
		c.lineTo(w * 0.8443, h * 0.546);
		c.lineTo(w * 0.9071, h * 0.5701);
		c.lineTo(w, h * 0.5022);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8407, h * 0.5504);
		c.lineTo(w * 0.8993, h * 0.5759);
		c.lineTo(w * 0.6757, h * 0.7416);
		c.lineTo(w * 0.6286, h * 0.7139);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.5321);
		c.lineTo(w * 0.6979, h * 0.7549);
		c.lineTo(w * 0.7457, h * 0.7781);
		c.lineTo(w * 0.9814, h * 0.6094);
		c.lineTo(w, h * 0.6067);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w, h * 0.6254);
		c.lineTo(w * 0.7664, h * 0.792);
		c.lineTo(w * 0.9586, h * 0.9062);
		c.lineTo(w, h * 0.8786);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3093, h * 0.5464);
		c.lineTo(w * 0.4271, h * 0.6152);
		c.lineTo(w * 0.245, h * 0.7643);
		c.lineTo(w * 0.185, h * 0.7228);
		c.lineTo(w * 0.2493, h * 0.6728);
		c.lineTo(w * 0.2214, h * 0.6143);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.65);
		c.lineTo(w * 0.2179, h * 0.7826);
		c.lineTo(w * 0.1136, h * 0.8424);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.7272);
		c.lineTo(w * 0.0821, h * 0.859);
		c.lineTo(0, h * 0.9085);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4529, h * 0.6366);
		c.lineTo(w * 0.575, h * 0.7143);
		c.lineTo(w * 0.39, h * 0.8621);
		c.lineTo(w * 0.2657, h * 0.7902);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(0, h * 0.9415);
		c.lineTo(w * 0.1036, h * 0.8821);
		c.lineTo(w * 0.2343, h * 0.959);
		c.lineTo(w * 0.1721, h);
		c.lineTo(0, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2586, h * 0.7951);
		c.lineTo(w * 0.3829, h * 0.8674);
		c.lineTo(w * 0.2543, h * 0.9451);
		c.lineTo(w * 0.1279, h * 0.8692);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2836, h * 0.9639);
		c.lineTo(w * 0.4207, h * 0.8772);
		c.lineTo(w * 0.605, h * 0.7321);
		c.lineTo(w * 0.6521, h * 0.7634);
		c.lineTo(w * 0.3486, h);
		c.lineTo(w * 0.3393, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.3879, h);
		c.lineTo(w * 0.6721, h * 0.7759);
		c.lineTo(w * 0.7171, h * 0.7982);
		c.lineTo(w * 0.4564, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.4986, h);
		c.lineTo(w * 0.7386, h * 0.8125);
		c.lineTo(w * 0.9307, h * 0.925);
		c.lineTo(w * 0.8264, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.8671, h);
		c.lineTo(w * 0.9464, h * 0.9491);
		c.lineTo(w, h * 0.975);
		c.lineTo(w, h);
		c.close();
		c.fillAndStroke();

		c.begin();
		c.moveTo(w * 0.2295, h);
		c.lineTo(w * 0.2648, h * 0.9792);
		c.lineTo(w * 0.2981, h);
		c.close();
		c.fillAndStroke();

		w = wOld;
		h = hOld;
		c.translate( - w * 0.0928, - h * 0.08);
	}

	c.setStrokeWidth(1);
	c.setStrokeColor('#18211b');
	c.rect(w * 0.0928, h * 0.08, w * 0.8144, h * 0.816);
	c.stroke();

	c.setStrokeWidth(1.5);
	c.setAlpha(0.8);
	c.setStrokeColor('#dddddd');
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

	rSize = 22.5;
	c.begin();
	c.setStrokeColor('#666666');
	c.begin();
	c.moveTo(2.5, 2.5 + rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, 2.5 + rSize, 2.5);
	c.lineTo(w - rSize - 5, 2.5);
	c.arcTo(rSize, rSize, 0, 0, 1, w - 2.5, rSize + 2.5);
	c.lineTo(w - 2.5, h - rSize - 2.5);
	c.arcTo(rSize, rSize, 0, 0, 1, w - rSize - 2.5, h - 2.5);
	c.lineTo(rSize + 2.5, h - 2.5);
	c.arcTo(rSize, rSize, 0, 0, 1, 2.5, h - rSize - 2.5);
	c.close();	
	c.stroke();

	c.setAlpha(1);
	c.ellipse(w * 0.4948, h * 0.0444, w * 0.0103, h * 0.008);
	c.setStrokeWidth(2.5);
	c.setStrokeColor('#000000');
	c.setFillColor('#000099');
	c.fillAndStroke();

	c.setGradient('#bbbbbb', '#000000', w * 0.4588, h * 0.912, w * 0.0825, h * 0.064, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.ellipse(w * 0.4588, h * 0.912, w * 0.0825, h * 0.064);
	c.fill();

	c.setAlpha(0.5);
	c.ellipse(w * 0.4588, h * 0.912, w * 0.0825, h * 0.064);
	c.stroke();

	c.begin();
	c.setAlpha(0.85);
	c.setFillColor('#000000');
	c.moveTo(w * 0.4598, h * 0.944);
	c.arcTo(w * 0.0402, h * 0.0296, 0, 0, 1, w * 0.5402, h * 0.944);
	c.arcTo(w * 0.0825, h * 0.064, 0, 0, 1, w * 0.4598, h * 0.944);
	c.close();
	c.fillAndStroke();

	c.begin();
	c.setAlpha(0.7);
	c.setStrokeWidth(1.5);
	c.setStrokeColor('#dddddd');
	rSize = 4;
	c.roundrect(w * 0.4814, h * 0.9296, w * 0.0371, h * 0.0288, h * 0.00515, h * 0.004);
	c.stroke();
};

mxCellRenderer.registerShape(mxMockupC.SHAPE_IPAD, mxShapeMockupiPad);

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
		RRECT : 'mxgraph.ios.rrect',
		R_SIZE : 'rSize'
};

mxShapeMockupRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:5},
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
//Top Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIosTopButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIosTopButton, mxShape);

mxShapeIosTopButton.prototype.cst = {
		TOP_BUTTON : 'mxgraph.ios.topButton',
		R_SIZE : 'rSize'
};

mxShapeIosTopButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:5},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIosTopButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIosTopButton.prototype.cst.R_SIZE, '10'));

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

mxCellRenderer.registerShape(mxShapeIosTopButton.prototype.cst.TOP_BUTTON, mxShapeIosTopButton);

//**********************************************************************************************************************************************************
//Bottom Button
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIosBottomButton(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIosBottomButton, mxShape);

mxShapeIosBottomButton.prototype.cst = {
		BOTTOM_BUTTON : 'mxgraph.ios.bottomButton',
		R_SIZE : 'rSize'
};

mxShapeIosBottomButton.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:5},
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIosBottomButton.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeIosBottomButton.prototype.cst.R_SIZE, '10'));

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

mxCellRenderer.registerShape(mxShapeIosBottomButton.prototype.cst.BOTTOM_BUTTON, mxShapeIosBottomButton);

//**********************************************************************************************************************************************************
//Anchor (a dummy shape without visuals used for anchoring)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIosAnchor(bounds, fill, stroke, strokewidth)
{
	mxShape.call(this);
	this.bounds = bounds;
};

/**
* Extends mxShape.
*/
mxUtils.extend(mxShapeIosAnchor, mxShape);

mxShapeIosAnchor.prototype.cst = {
		ANCHOR : 'mxgraph.ios.anchor'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIosAnchor.prototype.paintVertexShape = function(c, x, y, w, h)
{
};

mxCellRenderer.registerShape(mxShapeIosAnchor.prototype.cst.ANCHOR, mxShapeIosAnchor);

//**********************************************************************************************************************************************************
//Checkbox
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeIosCheckbox(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeIosCheckbox, mxShape);

mxShapeIosCheckbox.prototype.cst = {
		CHECKBOX : 'mxgraph.ios.checkbox'
};

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeIosCheckbox.prototype.paintVertexShape = function(c, x, y, w, h)
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

mxCellRenderer.registerShape(mxShapeIosCheckbox.prototype.cst.CHECKBOX, mxShapeIosCheckbox);

//**********************************************************************************************************************************************************
//Fancy Rounded rectangle (adjustable rounding)
//**********************************************************************************************************************************************************
/**
* Extends mxShape.
*/
function mxShapeMockupFancyRRect(bounds, fill, stroke, strokewidth)
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
mxUtils.extend(mxShapeMockupFancyRRect, mxShape);

mxShapeMockupFancyRRect.prototype.cst = {
		FANCY_RRECT : 'mxgraph.ios.fancyRRect',
		R_SIZE : 'rSize'
};

mxShapeMockupFancyRRect.prototype.customProperties = [
	{name: 'rSize', dispName: 'Arc Size', type: 'float', min:0, defVal:8}
];

/**
* Function: paintVertexShape
* 
* Paints the vertex shape.
*/
mxShapeMockupFancyRRect.prototype.paintVertexShape = function(c, x, y, w, h)
{
	c.translate(x, y);

	var rSize = parseInt(mxUtils.getValue(this.style, mxShapeMockupFancyRRect.prototype.cst.R_SIZE, '10'));
	var fillColor = mxUtils.getValue(this.style, mxConstants.STYLE_FILLCOLOR, '#ffffff');
	var strokeColor = mxUtils.getValue(this.style, mxConstants.STYLE_STROKECOLOR, '#000000');

//	c.setAlpha(0.8);
	c.roundrect(0, 0, w, h, rSize);
	c.fillAndStroke();
	
	c.setShadow(false);
	
	c.setStrokeColor(fillColor);
	c.setGradient(fillColor, '#ffffff', 0, 0, w, 22.5, mxConstants.DIRECTION_SOUTH, 1, 1);
	c.setAlpha(0.3);
	c.begin();
	c.moveTo(w - rSize, 0);
	c.arcTo(rSize, rSize, 0, 0, 1, w, rSize);
	c.lineTo(w, 17.5);
	c.arcTo(w * 1.67, h * 2.5, 0, 0, 1, 0, 17.5);
	c.lineTo(0, rSize);
	c.arcTo(rSize, rSize, 0, 0, 1, rSize, 0);
	c.close();
	c.fillAndStroke();

	c.setAlpha(0.8);
	c.setStrokeColor(strokeColor);
	c.setStrokeWidth(1);
	c.roundrect(0, 0, w, h, rSize, rSize);
	c.stroke();
};

mxCellRenderer.registerShape(mxShapeMockupFancyRRect.prototype.cst.FANCY_RRECT, mxShapeMockupFancyRRect);
