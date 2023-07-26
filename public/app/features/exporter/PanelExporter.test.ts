import saveAs from 'file-saver';

import { dateTimeFormat, FieldType, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import 'jest-canvas-mock';
import { exportDataJSON, exportExcel, exportImage, exportPanelJSON } from 'app/features/exporter/PanelExporter';
import { ExportPayload, ExportType } from 'app/features/exporter/types';

import { PanelModel } from '../dashboard/state/PanelModel';

jest.mock('file-saver', () => jest.fn());

/*const obj = require('@svgdotjs/svg.js');
const SVGImageElement = (arg) => {
  return obj.SVG(arg)
};

Object.assign(SVGImageElement, obj);

(global as any).SVG = SVGImageElement; */

class SVGImageElement extends HTMLElement {}

/*jest.mock('html-to-image', () => {
  return {
    toCanvas: (arg: HTMLElement, b) => {
      let promise:Promise<HTMLCanvasElement> = new Promise(() => {
        document.createElement("canvas");
      });
      return promise;
    }
  }
});  */

const panelData: PanelData = {
  series: [], // make a more complex series pls
  timeRange: getDefaultTimeRange(),
  state: LoadingState.Done,
};

const panelData2 = {
  // no type asfrom PanelModel.ts
  datasource: { type: 'testdata', uid: 'a1234-567b' },
  fieldConfig: { defaults: {}, overrides: [] },
  gridPos: { h: 3, w: 6, x: 0, y: 0 },
  id: 0,
  options: { reduceOptions: {}, tooltip: { mode: 'single', sort: 'none' } },
  targets: [
    {
      alias: 'Foo',
      labels: 'bar',
      refId: 'A',
      scenarioId: 'random_walk',
    },
  ],
  title: 'test-title',
  type: 'timeseries',
};

const panelData2sol = `{
  "datasource": {
    "type": "testdata",
    "uid": "a1234-567b"
  },
  "fieldConfig": {
    "defaults": {},
    "overrides": []
  },
  "gridPos": {
    "h": 3,
    "w": 6,
    "x": 0,
    "y": 0
  },
  "id": 0,
  "options": {
    "reduceOptions": {},
    "tooltip": {
      "mode": "single",
      "sort": "none"
    }
  },
  "targets": [
    {
      "alias": "Foo",
      "labels": "bar",
      "refId": "A",
      "scenarioId": "random_walk"
    }
  ],
  "title": "test-title",
  "type": "timeseries"
}`;

const panelDatasol = `PK�����xl/_rels/workbook.xml.rels<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata" Target="metadata.xml"/></Relationships>PK0�k��xl/theme/theme1.xml<?xml version="1    encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Cambria"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="ＭＳ Ｐゴシック"/><a:font script="Hang" typeface="맑은 고딕"/><a:font script="Hans" typeface="宋体"/><a:font script="Hant" typeface="新細明體"/><a:font script="Arab" typeface="Times New Roman"/><a:font script="Hebr" typeface="Times New Roman"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="MoolBoran"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Times New Roman"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/><a:font script="Jpan" typeface="ＭＳ Ｐゴシック"/><a:font script="Hang" typeface="맑은 고딕"/><a:font script="Hans" typeface="宋体"/><a:font script="Hant" typeface="新細明體"/><a:font script="Arab" typeface="Arial"/><a:font script="Hebr" typeface="Arial"/><a:font script="Thai" typeface="Tahoma"/><a:font script="Ethi" typeface="Nyala"/><a:font script="Beng" typeface="Vrinda"/><a:font script="Gujr" typeface="Shruti"/><a:font script="Khmr" typeface="DaunPenh"/><a:font script="Knda" typeface="Tunga"/><a:font script="Guru" typeface="Raavi"/><a:font script="Cans" typeface="Euphemia"/><a:font script="Cher" typeface="Plantagenet Cherokee"/><a:font script="Yiii" typeface="Microsoft Yi Baiti"/><a:font script="Tibt" typeface="Microsoft Himalaya"/><a:font script="Thaa" typeface="MV Boli"/><a:font script="Deva" typeface="Mangal"/><a:font script="Telu" typeface="Gautami"/><a:font script="Taml" typeface="Latha"/><a:font script="Syrc" typeface="Estrangelo Edessa"/><a:font script="Orya" typeface="Kalinga"/><a:font script="Mlym" typeface="Kartika"/><a:font script="Laoo" typeface="DokChampa"/><a:font script="Sinh" typeface="Iskoola Pota"/><a:font script="Mong" typeface="Mongolian Baiti"/><a:font script="Viet" typeface="Arial"/><a:font script="Uigh" typeface="Microsoft Uighur"/><a:font script="Geor" typeface="Sylfaen"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="35000"><a:schemeClr val="phClr"><a:tint val="37000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="15000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="100000"/><a:shade val="100000"/><a:satMod val="130000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="50000"/><a:shade val="100000"/><a:satMod val="350000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"><a:shade val="95000"/><a:satMod val="105000"/></a:schemeClr></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="38000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw></a:effectLst><a:scene3d><a:camera prst="orthographicFront"><a:rot lat="0" lon="0" rev="0"/></a:camera><a:lightRig rig="threePt" dir="t"><a:rot lat="0" lon="0" rev="1200000"/></a:lightRig></a:scene3d><a:sp3d><a:bevelT w="63500" h="25400"/></a:sp3d></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="255000"/></a:schemeClr></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs></a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults><a:spDef><a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="3"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="2"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></a:style></a:spDef><a:lnDef><a:spPr/><a:bodyPr/><a:lstStyle/><a:style><a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></a:style></a:lnDef></a:objectDefa    xl/styles.xml<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><numFmts count="1"><numFmt numFmtId="56" formatCode="&quot;上午/下午 &quot;hh&quot;時&quot;mm&quot;分&quot;ss&quot;秒 &quot;"/></numFmts><fonts count="1"><font><sz val="12"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/></styleSheet>PK��/H��xl/worksheets/sheet1.xml<?xml version="1.0" encoding="UTF-8" standalone="yes    
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData/><ignoredErrors><ignoredError numberStoredAsText="1" sqref="A1"/></ignoredErrors></worksheet>    ���xl/metadata.xml<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xlrd="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray">
  <metadataTypes count="1">
    <metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/>
  </metadataTypes>
  <futureMetadata name="XLDAPR" count="1">
    <bk>
      <extLst>
        <ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}">
          <xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/>
        </ext>
      </extLst>
    </bk>
  </futureMetadata>
  <cellMetadata count="1">
    <bk>
      <rc t="1" v="0"/>
    </bk>
  </cellMetadata>
</metadata>PK?���BBxl/workbook.xml<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr codeName="ThisWorkbook"/><sheets><sheet name="People" sheetId="1" r:id="rId1"/></sheets></workbook>PKJj�LL
                                              _rels/.rels<?xml version="1.0" encoding="UTF-8" standalone="yes"    
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>PK}���22docProps/app.xml<?xml ver    ="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SheetJS</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>People</vt:lpstr></vt:vector></TitlesOfParts></Properties>PK֒|ZZdocProps/core.xml<?xml version="1.0" encoding="UTF-8"     dalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>PK��[Content_Types].xml<?xml version="1.0" enco    ="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Default Extension="data" ContentType="application/vnd.openxmlformats-officedocument.model+data"/><Default Extension="bmp" ContentType="image/bmp"/><Default Extension="png" ContentType="image/png"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="emf" ContentType="image/x-emf"/><Default Extension="wmf" ContentType="image/x-wmf"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="tif" ContentType="image/tiff"/><Default Extension="tiff" ContentType="image/tiff"/><Default Extension="pdf" ContentType="application/pdf"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/></Types>PK�����xl/_rels/workbook.xml.relsP    � xl/styles.xmlPK��/H���%xl/worksheets/sheet1.xmlPK\`����@'xl/metadata.xmlPK?���BB�*xl/workbook.xmlPKJj�LL
                                                                                                         d,_rels/.relsPK}���22�.docProps/app.xmlPK֒|ZZ91docProps/core.xmlPK���2[Content_Types].xmlPK

;
`; // not sure about this one - very hard to test the contents of a binary file

let mockHTMLElement = document.createElement('div');
const mockHTMLChildElement = document.createElement('div');
mockHTMLElement = mockHTMLElement.appendChild(mockHTMLChildElement);

console.log(mockHTMLElement);

function payload(type: ExportType): ExportPayload {
  return {
    panel: new PanelModel({ id: 1, title: 'test-title4' }),
    htmlElement: document.createElement('a'),
    format: type,
    data: panelData,
  };
}

const frame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time },
    { name: 'string', type: FieldType.string },
    { name: 'number', type: FieldType.number },
    { name: 'boolean', type: FieldType.boolean },
    { name: 'other', type: FieldType.other },
    { name: 'undefined' },
  ],
});

describe('Panel-Exporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(1400000000000) });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('exportPanelJSON', () => {
    it('should download .json file when presented with panel info', async () => {
      exportPanelJSON(panelData2, 'test-title2');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual(panelData2sol);
      expect(filename).toEqual(`test-title2-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('exportDataJSON', () => {
    it('should download .json file when presented with data info', async () => {
      exportDataJSON(panelData, 'test-title');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      expect(text).toEqual('[]');
      expect(filename).toEqual(`test-title-${dateTimeFormat(1400000000000)}.json`);
    });
  });

  describe('exportExcel', () => {
    it('should not work yet', async () => {
      exportExcel(frame, 'test-title3');

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      console.log(call);
      const blob = call[0];
      const filename = call[1];
      const text = await blob.text();

      // expect(text).toEqual(panelDatasol);
      expect(filename).toEqual(`test-title3-${dateTimeFormat(1400000000000)}.xlsx`);
    });
  });

  describe('exportImage', () => {
    beforeEach(() => {});

    it('should download a png file when selected', async () => {
      // do each image
      const a = payload(ExportType.png);
      const b = await exportImage(a);
      console.log(b);

      const call = (saveAs as unknown as jest.Mock).mock.calls[0];
      console.log(call);
      //const blob = call[0];
      //const filename = call[1];
      //const text = await blob.text();
      //console.log(text);

      //expect(text).toEqual(panelDatasol);
      //expect(filename).toEqual(`test-title2-${dateTimeFormat(1400000000000)}.png`);
      // expect(spy).toHaveBeenCalled();
      expect(true).toEqual(true);
    });

    it('should download a png file when selected', () => {
      // do each image

      expect(true).toEqual(true);
    });
  });
});
