import jsPDF from 'jspdf';
import autoTable, { CellHook, PageHook } from 'jspdf-autotable';
import tinycolor from 'tinycolor2';

import { isMultilingualPdfEnabled } from '@grafana/data/src/utils/scriptUtils';

import { fontsMap, getMultilingualFont, registerFont } from './fontUtils';
import { CreateFromCSVOptions, CreateFromHTMLOptions, Script, TemplateOptions, ThemeOptions } from './types';
import { blendWithTheme, parseCSV, parseCsvMeta, rowsLimitNote, truncateText } from './utils';

class PDFGenerator {
  public doc: jsPDF;
  public options: TemplateOptions;

  public fontFamily = 'helvetica';
  public static defaultFont = 'helvetica';
  public static metaTag = '[@meta@]';

  constructor(options: TemplateOptions) {
    this.options = options;
    this.doc = new jsPDF(options.orientation === 'landscape' ? 'l' : 'p', 'pt', [842.4, 1190.88]);
  }

  /**
   * Creates a header for the PDF document.
   *
   * @param {number} recordsCount - The number of records to be displayed in the PDF.
   * @param {ThemeOptions} theme - The theme options for styling the PDF.
   * @returns {PageHook} A function that sets up the header for each page of the PDF.
   *
   * The header includes:
   * - A colored header section.
   * - A background fill color for the rest of the page.
   * - Text for the dashboard path, data time range, report name, and a description.
   * - The panel title on the first page.
   * - A note about the rows limit if applicable.
   * - The company logo.
   * - A horizontal line separating the header from the content.
   */
  public createHeader = (theme: ThemeOptions, recordsCount = 0): PageHook => {
    const rowsLimit = rowsLimitNote(this.options.table.recordLimit);
    const template = this.options.brand;
    const margin = this.options.margin.left;
    const hideDashboardPath = this.options.hideDashboardPath;
    return (data) => {
      // Based on limit value making the rows limit caption string.
      this.doc.setFillColor(theme.headerSectionColor);
      this.doc.rect(0, 0, this.doc.internal.pageSize.getWidth(), 80, 'F');
      this.doc.setFillColor(theme.backGroundFillColor);
      this.doc.rect(0, 80, this.doc.internal.pageSize.getWidth(), this.doc.internal.pageSize.getHeight() - 80, 'F');
      let pageWidth = this.doc.internal.pageSize.getWidth();
      const maxWidth = this.doc.internal.pageSize.getWidth() * 0.7; //70% of pageWidth
      this.doc.setTextColor(theme.headerTextColor);
      this.doc.setFontSize(8).setFont(this.fontFamily, 'bold');
      if (!hideDashboardPath) {
        const dashboardPath = truncateText(this.doc, this.options.dashboardPath, maxWidth);
        this.doc.text(dashboardPath, margin, 20);
      }

      if (template.timeRange.from) {
        this.doc.setFontSize(8).setFont(PDFGenerator.defaultFont, 'bold');
        const rangeLabelWidth = this.doc.getTextWidth('Data time range: ' + template.timeRange.from) + 15;
        this.doc.text('Data time range: ', this.doc.internal.pageSize.getWidth() - rangeLabelWidth, 20);
        const toLabelWidth = this.doc.getTextWidth('to ' + template.timeRange.to) + 15;
        this.doc.text('to ', this.doc.internal.pageSize.getWidth() - toLabelWidth, 30);
        this.doc.setFontSize(8).setFont(PDFGenerator.defaultFont, 'normal');
        // Below 65 is calculated by this.doc.getTextWidth('Data time range: ') + some margin
        this.doc.text(template.timeRange.from, this.doc.internal.pageSize.getWidth() - rangeLabelWidth + 65, 20);
        // Below 10 is calculated by this.doc.getTextWidth('to ') + some margin
        this.doc.text(template.timeRange.to, this.doc.internal.pageSize.getWidth() - toLabelWidth + 10, 30);
      }

      this.doc.setFontSize(12).setFont(this.fontFamily, 'bold');
      const reportName = truncateText(this.doc, template.reportName, maxWidth);
      this.doc.text(reportName, margin, 50);

      if (!!template.reportDescription) {
        this.doc.setFontSize(10).setFont(this.fontFamily, 'normal');
        let description = this.doc.splitTextToSize(template.reportDescription, pageWidth - 35, {});
        this.doc.text(description, margin, 65);
      }

      // Displaying the panel title only on the first page of the pdf for the table panel.
      if (data.pageNumber === 1) {
        this.doc.setFontSize(10).setFont(this.fontFamily, 'bold');
        this.doc.text(this.options.table.panelTitle, margin, 95);

        // Adding rows limit note on the first page of each table pdf.
        if (this.options.table.recordLimit && recordsCount >= Number(this.options.table.recordLimit) - 1) {
          this.doc.setFontSize(8);
          this.doc.text(rowsLimit, this.doc.internal.pageSize.getWidth() - 300, 95);
          this.doc.setFontSize(10);
        }
      }

      const imgProps = this.doc.getImageProperties(template.companyLogo!);
      const fixedLogoHeight = 32;
      const fixedLogoWidth = (imgProps.width / imgProps.height) * fixedLogoHeight;
      const logoStartXPosition = fixedLogoWidth + 17;
      const logoStartYPosition = 37;

      this.doc.addImage(
        template.companyLogo!,
        imgProps.fileType,
        this.doc.internal.pageSize.getWidth() - logoStartXPosition,
        logoStartYPosition,
        fixedLogoWidth,
        fixedLogoHeight
      );
      this.doc.setDrawColor(theme.lineDrawColor);
      this.doc.setLineWidth(1.3);
      this.doc.line(margin, 75, this.doc.internal.pageSize.getWidth() - margin, 75);
    };
  };

  /**
   * Creates a footer for the PDF document.
   *
   * @param {ThemeOptions} theme - The theme options to style the footer.
   * @returns {PageHook} A function that adds the footer to the PDF document.
   *
   * The footer includes:
   * - A colored rectangle at the bottom of the page.
   * - Optionally, the text "Generated on:" followed by the generation date if `hideDashboardPath` is false.
   * - Footer text aligned to the right with a hyperlink.
   */
  public createFooter = (theme: ThemeOptions): PageHook => {
    const template = this.options.brand;
    return (_) => {
      this.doc.setFillColor(theme.headerSectionColor).setTextColor(theme.headerTextColor).setFontSize(8);

      this.doc.rect(0, this.doc.internal.pageSize.getHeight() - 30, this.doc.internal.pageSize.getWidth(), 30, 'F');
      if (!this.options.hideDashboardPath) {
        this.doc.setFontSize(8).setFont(PDFGenerator.defaultFont, 'bolditalic');
        this.doc.text('Generated on:', 15, this.doc.internal.pageSize.getHeight() - 15);
        this.doc.setFont(PDFGenerator.defaultFont, 'italic');
        this.doc.text(template.generatedAt, 15 + 57, this.doc.internal.pageSize.getHeight() - 15);
      }

      // Multilingual PDF: fonts need to be set before calculating the text width for correct calculations.
      this.doc.setFont(this.fontFamily, this.fontFamily === PDFGenerator.defaultFont ? 'bolditalic' : 'bold');
      const xStartingPoint = this.doc.internal.pageSize.getWidth() - this.doc.getTextWidth(template.footerText!) - 15;
      this.doc
        .text(template.footerText!, xStartingPoint, this.doc.internal.pageSize.getHeight() - 15)
        .link(
          xStartingPoint,
          this.doc.internal.pageSize.getHeight() - 30,
          this.doc.getTextWidth(template.footerText!),
          15,
          {
            url: template.footerURL!,
          }
        );
    };
  };

  /**
   * Applies header styling to a table cell.
   *
   * @param {any} data - The cell data containing column and cell information.
   * @param {ThemeOptions} theme - The theme options for styling.
   *
   * This function sets the header background color, text color, line color, and line width
   * for both the cell styles and the document drawing context.
   */
  private addHeaderStyle(data: any, theme: ThemeOptions): void {
    const columnMeta = data.column.meta || {};
    const headerBgColor = columnMeta.headerBgColor || theme.tableHeaderFillColor;
    const headerColor = columnMeta.headerColor || theme.tableHeaderTextColor;
    this.doc.setFillColor(headerBgColor);
    this.doc.setTextColor(headerColor);
    this.doc.setDrawColor(theme.lineColor);
  }

  /**
   * Creates a cell hook for customizing the appearance and behavior of table cells in a PDF document.
   *
   * @param {ThemeOptions} theme - The theme options to apply to the cell.
   * @returns {CellHook} A function that takes cell data and applies the specified styles and behaviors.
   *
   * The returned cell hook function performs the following actions:
   * - Sets the text color based on the provided theme.
   * - Updates the header text alignment based on the column's horizontal alignment.
   * - If the cell is in the body section and has metadata, it applies various styles and behaviors:
   *   - Sets the font size and font style.
   *   - Applies text color or background color based on the column's color type.
   *   - Adjusts text color for better visibility if the background color is dark.
   *   - Adds a hyperlink to the cell if specified in the metadata.
   *   - Sets the font for barcode type columns.
   * - If the cell is not in the body section, it sets the fill color based on the provided theme.
   */
  public createCell(theme: ThemeOptions): CellHook {
    return (data: any) => {
      this.doc.setTextColor(theme.textColor);
      // Updating the header text alignment which is dervied from text alignment of data.
      if (data.column.halign) {
        data.cell.styles.halign = data.column.halign;
      }
      if (data.cell.section === 'head') {
        this.addHeaderStyle(data, theme);
      } else if (data.cell.section === 'body' && data.cell.meta) {
        const columnMeta = data.column.meta;
        const cellMeta = data.cell.meta;
        this.doc.setFontSize(12).setFont(this.fontFamily, 'bold');
        // Colored text Type
        if (columnMeta.colorType === 't') {
          const color = blendWithTheme(tinycolor(cellMeta.c).toHex8String(), this.options.theme);
          this.doc.setTextColor(color.r, color.g, color.b);
        }
        // Colored background
        if (columnMeta.colorType === 'b') {
          const color = blendWithTheme(tinycolor(cellMeta.c).toHex8String(), this.options.theme);
          this.doc.setFillColor(color.r, color.g, color.b);
          // If background color is dark then need to change the font to light color to make it visible and viceversa.
          if (tinycolor(cellMeta.c).isDark()) {
            this.doc.setTextColor('#FFFFFF');
          } else {
            this.doc.setTextColor('#2C2C2C');
          }
        }
        // Adding the link and styling of the link.
        if (cellMeta.u) {
          // If there is no background color then using the user selected text color for the hyperlink.
          if (columnMeta.colorType !== 'b') {
            const color = blendWithTheme(tinycolor(cellMeta.c).toHex8String(), this.options.theme);
            this.doc.setTextColor(color.r, color.g, color.b);
          }

          // Because of variable text size and alignment, it is best and simple to provide the hyperlink to full cell
          // to avoid unnecessary calculation about starting point and ending point of the link cursor box.
          this.doc.link(data.cell.x, data.cell.y, data.column.width, data.cell.contentHeight, {
            url: cellMeta.u,
          });
        }
        //Adding style to footer row
        if (cellMeta.f && cellMeta.f.toString() === '1') {
          const footerFillColor = tinycolor(theme.footerRowColor).toRgb();
          const footerTextColor = tinycolor(theme.headerTextColor).toRgb();

          this.doc.setFillColor(footerFillColor.r, footerFillColor.g, footerFillColor.b);
          this.doc.setTextColor(footerTextColor.r, footerTextColor.g, footerTextColor.b);
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 14;
        }
        // Adding the barcode font type.
        if (columnMeta.type && columnMeta.type === 'b') {
          this.doc.setFontSize(45);
          const barcodeFont = fontsMap['barcode']!;
          this.doc.setFont(barcodeFont.fontName, barcodeFont.fontStyle);
        } else {
          this.doc.setFontSize(10).setFont(this.fontFamily, 'normal');
        }
      } else {
        this.doc.setFillColor(theme.fillColor);
      }
    };
  }

  /**
   * Parses the cell data and updates the cell and column metadata based on the provided headers metadata.
   * This function is intended to be used as a cell hook in a PDF generation process.
   *
   * @param headersMeta - An array of metadata objects for the headers.
   * @returns A CellHook function that processes the cell data.
   *
   * The returned CellHook function performs the following:
   * - Checks if the cell contains the PDF meta tag.
   * - If the cell is in the header section, updates the cell text and alignment based on the header metadata.
   * - If the cell is in the body section, updates the cell text to remove meta tags and sets the cell metadata.
   *
   * The cell metadata includes properties such as alignment and color, which are used in subsequent cell rendering functions.
   */
  public parseCell(headersMeta: any[]): CellHook {
    return (data: any) => {
      const isOK = data.cell.raw && data.cell.raw.indexOf(PDFGenerator.metaTag) > -1;
      if (!isOK) {
        return;
      }
      data.cell.styles.overflow = 'linebreak';
      let cellData = data.cell.raw?.toString() ?? '';
      const match = cellData.split(PDFGenerator.metaTag);
      if (match.length !== 2) {
        return;
      }

      if (data.cell.section === 'head') {
        const meta = headersMeta[data.column.index];
        if (data.cell.text) {
          data.cell.text = match[0];
        }
        // if cell type is number then with 'auto' text alignment, we align the numbers to 'right'
        // and for remaining types default is 'left' in the output PDF.
        let alignment = meta.type === 'n' && meta.alignment === 'a' ? 'right' : 'left';
        if (meta.alignment === 'r') {
          alignment = 'right';
        } else if (meta.alignment === 'c') {
          alignment = 'center';
        }
        // Adding the temp halign property in column instance to use that value in the next function willDrawCell
        // so that while drawing the headers, we will respect the data text alignment.
        data.column.halign = alignment;
        data.column.meta = meta;
        return;
      }

      if (data.cell.section === 'body') {
        // Updating the cell text because the default text from csv is long with href details and jspdf
        // automatic scaling will assign unncessary huge space to the column because of meta tags.
        if (data.cell.text) {
          const length = data.cell.text.length;
          if (length > 0) {
            // If there is text formatting and multiline text in the column then meta tag will be
            // present in the last line so need to truncate only the last line.
            const lastLine = data.cell.text[length - 1];
            if (lastLine.indexOf(PDFGenerator.metaTag) > -1) {
              data.cell.text[length - 1] = lastLine.substring(0, lastLine.indexOf(PDFGenerator.metaTag));
            }
          }
        }

        // Creating meta instance which contains the details about each and every cell and setting it in cell
        // instance so that we can use it in willDrawCell.
        let pairs = match[1].split(' ');
        let meta: any = {};
        pairs.forEach(function (pair: any) {
          let splitIndex = pair.indexOf('=');
          let key = pair.substring(0, splitIndex);
          let value = pair.substring(splitIndex + 1);
          if (!value) {
            return;
          }
          // When there is no color on the cell then getting invalid hexcode hence updating it with default white.
          if (key === 'c' && value === '#00000000') {
            value = '#FFFFFF';
          }
          meta[key] = value;
        });
        data.cell.meta = meta;
        return;
      }
    };
  }

  /**
   * Retrieves the theme options based on the current theme setting.
   *
   * @returns {ThemeOptions} An object containing the theme options.
   *
   * The returned object includes the following properties:
   * - `fillColor`: The fill color for the theme.
   * - `textColor`: The text color for the theme.
   * - `lineColor`: The line color for the theme.
   * - `backGroundFillColor`: The background fill color for the theme.
   * - `tableHeaderFillColor`: The fill color for table headers.
   * - `tableHeaderTextColor`: The text color for table headers.
   * - `headerTextColor`: The text color for headers.
   * - `lineDrawColor`: The color used for drawing lines.
   * - `headerSectionColor`: The color for the header section.
   */
  public getTheme = (): ThemeOptions => {
    const isLight = this.options.theme === 'light';
    return {
      fillColor: isLight ? '#FFFFFF' : '#181B1F',
      textColor: isLight ? '#505050' : '#CCCCDC',
      lineColor: isLight ? '#C7C7C7' : '#25272C',
      backGroundFillColor: isLight ? '#F4F5F5' : '#0B0C0E',
      tableHeaderFillColor: isLight ? '#E0E0E0' : '#181B1F',
      tableHeaderTextColor: isLight ? '#000000' : '#CCCCDC',
      headerTextColor: isLight ? '#000000' : '#9FA7B3',
      lineDrawColor: isLight ? '#000000' : '#2F2F32',
      headerSectionColor: isLight ? '#FFFFFF' : '#0B0C0E',
      footerRowColor: isLight ? '#F2F2F2' : '#2A2A2A',
    };
  };

  /**
   * Generates a PDF document from CSV content and saves it to the specified file path.
   *
   * @param {CreateOptions} options - The options for creating the PDF.
   * @param {string} options.csvContent - The CSV content to be parsed and converted into a PDF.
   * @param {string} options.filePath - The file path where the generated PDF will be saved.
   *
   * @returns {Promise<void>} A promise that resolves when the PDF has been successfully saved.
   *
   * @throws {Error} Throws an error if the CSV parsing or PDF generation fails.
   *
   * The function performs the following steps:
   * 1. Parses the CSV content.
   * 2. Extracts metadata from the CSV headers.
   * 3. Calculates the total custom width and scaling factor for the columns.
   * 4. Determines the column styles based on the metadata and options.
   * 5. Configures the table styles and settings for the PDF.
   * 6. Generates the PDF using the autoTable library.
   * 7. Saves the generated PDF to the specified file path.
   */
  public createFromCSV = async ({ csvContent }: CreateFromCSVOptions): Promise<void> => {
    const data = await parseCSV(csvContent);

    const headersMeta = parseCsvMeta(data.header, PDFGenerator.metaTag);
    const barcodeColumnWidth = 230;
    const totalCustomWidth =
      headersMeta.reduce((sum, headerMeta) => {
        return headerMeta.type !== 'b' ? sum + (headerMeta.width > 0 ? headerMeta.width : 0) : sum;
      }, 0) || 1;

    const scalingFactor = Math.min(this.doc.internal.pageSize.getWidth() / totalCustomWidth, 1);
    const { barcodeColumns, barcodeColumnsLength, otherColumns } = headersMeta.reduce(
      (acc, meta, index) => {
        if (meta.type === 'b') {
          acc.barcodeColumns[index] = { cellWidth: barcodeColumnWidth };
          acc.barcodeColumnsLength++;
        } else if (meta.width) {
          acc.otherColumns[index] = { cellWidth: meta.width * scalingFactor };
        }
        return acc;
      },
      {
        barcodeColumns: {} as { [index: number]: { cellWidth: number } },
        barcodeColumnsLength: 0,
        otherColumns: {} as { [index: number]: { cellWidth: number } },
      }
    );

    let availableWidth = this.doc.internal.pageSize.getWidth() - 40 - barcodeColumnsLength * barcodeColumnWidth;
    let columnStyles = barcodeColumns;

    if (this.options.table.customWidth) {
      availableWidth = availableWidth - Math.round(totalCustomWidth);
      if (availableWidth < 0) {
        availableWidth = 0;
      }
      columnStyles = { ...barcodeColumns, ...otherColumns };
    }

    // If tableScaling is selected while exporting, then equally dividing page width to all the columns or else
    // column width will be adjsuted by the content text. Mainly useful for large number of columns. for exa: 20.
    const fixedCellWidth = Math.round(availableWidth / data.header.length);

    if (barcodeColumnsLength) {
      // Adding the barcode font in jspdf as custom font-family.
      const font = fontsMap['barcode']!;
      const fileContent = await font.getFileContent();
      registerFont({ ...font, fileContent }, this.doc);
    }

    this.fontFamily = (await this.handleMultilingualFonts(headersMeta)) || PDFGenerator.defaultFont;

    const theme = this.getTheme();
    autoTable(this.doc, {
      theme: 'grid',
      head: [data.header],
      body: data.body,
      includeHiddenHtml: true,
      styles: {
        minCellWidth: this.options.table.tableScaling && data.header.length <= 20 ? fixedCellWidth : 0,
        minCellHeight: barcodeColumnsLength > 0 ? 60 : 0, // min 60 cell height is required for barcode with font size 45.
        fillColor: theme.fillColor,
        textColor: theme.textColor,
        lineColor: theme.lineColor,
      },
      headStyles: {
        fillColor: theme.tableHeaderFillColor,
        textColor: theme.tableHeaderTextColor,
        lineColor: theme.lineColor,
        lineWidth: 0.1,
        font: this.fontFamily,
      },

      columnStyles: columnStyles,
      margin: this.options.margin,
      startY: 105,

      // Upto 20 columns, fixed scaling will be applicable and after 20, horizontal page break will be enabled and
      // will drop the remaining columns to the next pages and will repeat first column values.
      horizontalPageBreak: data.header.length > 20 ? true : false,
      horizontalPageBreakRepeat: 0,
      horizontalPageBreakBehaviour: 'immediately',
      willDrawPage: this.createHeader(theme, data.body.length),
      didDrawPage: this.createFooter(theme),
      didParseCell: this.parseCell(headersMeta),
      willDrawCell: this.createCell(theme),
    });
  };

  /**
   * Creates a PDF document from an HTML element specified by the selector and saves it to the given file path.
   *
   * @param {Object} options - The options for creating the PDF.
   * @param {string} options.selector - The CSS selector of the HTML element to convert to PDF.
   * @param {string} options.filePath - The file path where the PDF will be saved.
   * @returns {Promise<void>} A promise that resolves when the PDF has been created and saved.
   *
   * @remarks
   * This method uses the `autoTable` function to generate a table in the PDF from the HTML element.
   * It applies styles and formatting based on the theme and options provided.
   *
   * The method also handles hyperlinks in the table cells, setting the appropriate links in the PDF.
   */
  public createFromHTML = async ({
    selector,
    theme = 'grid',
    useCss = false,
    firstColumnWidth,
  }: CreateFromHTMLOptions): Promise<void> => {
    const themeOptions = this.getTheme();
    const margin = this.options.margin.left;

    const columnStyles: any = {};
    if (firstColumnWidth) {
      const tableWidth = this.doc.internal.pageSize.getWidth() - this.options.margin.right - this.options.margin.left;
      const firstColWidth = (tableWidth * firstColumnWidth) / 100;
      columnStyles[0] = { cellWidth: firstColWidth }; // Set only the first column width
      columnStyles[1] = { cellWidth: 'auto' }; // Let second column fill the rest
    }

    autoTable(this.doc, {
      html: selector,
      theme: theme,
      useCss: useCss,
      styles: {
        fillColor: themeOptions.fillColor,
        textColor: themeOptions.textColor,
        lineColor: themeOptions.lineColor,
        font: this.fontFamily || PDFGenerator.defaultFont,
      },
      headStyles: {
        fillColor: themeOptions.tableHeaderFillColor,
        textColor: themeOptions.tableHeaderTextColor,
        lineWidth: 1,
      },
      columnStyles: columnStyles,
      margin: { top: 85, left: margin, right: margin, bottom: 50 },
      startY: 105,
      willDrawPage: this.createHeader(themeOptions),
      didDrawPage: this.createFooter(themeOptions),
      willDrawCell: (data: any) => {
        let fontFamily = this.fontFamily || 'helvetica';
        let computedStyle = getComputedStyle(data.cell.raw);
        // Sometimes getting below mentioned rgb code from the computed style function which is invalid as well.
        if (computedStyle.color && computedStyle.color !== 'rgba(0, 0, 0, 0)') {
          const tinyColor = tinycolor(computedStyle.color);
          if (tinyColor.isValid()) {
            const color = blendWithTheme(tinyColor.toHex8String(), this.options.theme);
            this.doc.setTextColor(color.r, color.g, color.b);
          }
        }
        if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          const tinyColor = tinycolor(computedStyle.backgroundColor);
          if (tinyColor.isValid()) {
            const color = blendWithTheme(tinyColor.toHex8String(), this.options.theme);
            this.doc.setFillColor(color.r, color.g, color.b);
          }
        }

        if (data.cell.section === 'head' && data.cell.raw.nodeName === 'TH') {
          // For head, getting the correct text alignment value in the textAlignLast proeprty.
          if (computedStyle.textAlignLast) {
            data.cell.styles.halign = computedStyle.textAlignLast;
          }
          this.doc.setFont(fontFamily, 'bold');
        } else {
          // For body, getting the correct text alignment value in the textAlign proeprty.
          if (computedStyle.textAlign) {
            data.cell.styles.halign = computedStyle.textAlign;
            data.cell.styles.minCellWidth = computedStyle.width;
          }
          this.doc.setFont(fontFamily, 'normal');
        }

        let href;
        // If hyperlink is set for TH table nodes then below code is used to set the link for head and body section.
        if (
          data.cell.raw &&
          data.cell.raw.nodeName === 'TH' &&
          data.cell.raw.firstChild &&
          data.cell.raw.firstChild.href
        ) {
          href = data.cell.raw.firstChild.href;
        }

        // Below code is specifically for setting the link for body values only with TD node type.
        // Because we are reading HtmlTableElement so parsing the anchor directly from that and finding
        // the hyperlink cells. This implementation is different then table plugin hyperlink support.
        if (
          !href &&
          data.cell.section === 'body' &&
          data.cell.raw &&
          data.cell.raw.firstChild &&
          data.cell.raw.firstChild.lastChild instanceof HTMLAnchorElement &&
          data.cell.raw.firstChild.lastChild.href
        ) {
          href = data.cell.raw.firstChild.lastChild.href;
        }

        // case for record details
        if (
          !href &&
          data.cell.section === 'body' &&
          data.cell.raw &&
          data.cell.raw.firstChild &&
          data.cell.raw.firstChild instanceof HTMLAnchorElement &&
          data.cell.raw.firstChild.href
        ) {
          href = data.cell.raw.firstChild.href;
        }

        if (href) {
          // Because of variable text size and alignment, it is best and simple to provide the hyperlink to full cell
          // to avoid unnecessary calculation about starting point and ending point of the link cursor box.
          this.doc.link(data.cell.x, data.cell.y, data.column.width, data.cell.contentHeight, {
            url: href,
          });
        }
      },
    });
  };

  public saveAs = async (fileName = 'exported-pdf') => {
    this.doc.outline.add(null, this.options.table.panelTitle || 'Untitled panel', { pageNumber: 1 });
    await this.doc.save(fileName, { returnPromise: true });
  };

  private async handleMultilingualFonts(headersMeta: any[]): Promise<string | null> {
    if (!isMultilingualPdfEnabled()) {
      return null;
    }

    let scriptFromCSV = headersMeta[0]?.lang as Script;
    const { brand, table, dashboardPath } = this.options;
    return await getMultilingualFont(
      this.doc,
      [brand.reportName, table.panelTitle, brand.reportDescription, brand.footerText, dashboardPath],
      scriptFromCSV
    );
  }
}

export default PDFGenerator;
