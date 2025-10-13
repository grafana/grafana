const fs = require('fs');
const { Jimp, diff } = require('jimp');
const pdf = require('pdf-parse');
const ms = require('smtp-tester');

const PORT = 7777;

const initialize = (on, config) => {
  // starts the SMTP server at localhost:7777
  const mailServer = ms.init(PORT);
  console.log('mail server at port %d', PORT);

  let lastEmail = {};

  // process all emails
  mailServer.bind((addr, id, email) => {
    lastEmail[email.headers.to] = email;
  });

  on('task', {
    resetEmails(recipient) {
      if (recipient) {
        console.log('reset all emails for recipient %s', recipient);
        delete lastEmail[recipient];
      } else {
        console.log('reset all emails');
        lastEmail = {};
      }
    },

    getLastEmail(email) {
      return lastEmail[email] || null;
    },
  });

  on('task', {
    async compareImages({ expectedImageFilepath, newImageContent, updateExpectedImage = false }) {
      const inputBuffer = Buffer.from(newImageContent.data);
      if (updateExpectedImage) {
        fs.writeFileSync(expectedImageFilepath, inputBuffer);
        return true;
      }

      const inputImage = await Jimp.read(inputBuffer);
      const expectedImage = await Jimp.read(expectedImageFilepath);

      const pixelDiff = diff(expectedImage, inputImage, 0.3);
      return pixelDiff.percent <= 0.1;
    },
  });

  on('task', {
    async compareCSVs({ expectedCSVFilepath, newCSVContent, updateExpectedCSV = false }) {
      const inputBuffer = Buffer.from(newCSVContent.data);
      if (updateExpectedCSV) {
        await fs.writeFileSync(expectedCSVFilepath, inputBuffer);
        return true;
      }

      const inputCSV = toCSV(inputBuffer);
      const expectedCSV = toCSV(fs.readFileSync(expectedCSVFilepath));

      if (inputCSV.length !== expectedCSV.length) {
        return false;
      }

      for (let i = 0; i < expectedCSV.length; i++) {
        const line = expectedCSV[i];
        for (let j = 0; j < line.length; j++) {
          if (line[j] !== inputCSV[i][j]) {
            return false;
          }
        }
      }

      return true;
    },
  });

  on('task', {
    async comparePDFs({ expectedPDFFilepath, newPDFContent, updateExpectedPDF = false }) {
      const inputBuffer = Buffer.from(newPDFContent.data);
      if (updateExpectedPDF) {
        fs.writeFileSync(expectedPDFFilepath, inputBuffer);
        return true;
      }

      const inputDoc = await pdf(inputBuffer);
      const expectedDoc = await pdf(expectedPDFFilepath);

      removePDFGeneratedOnDate(inputDoc);
      removePDFGeneratedOnDate(expectedDoc);

      if (inputDoc.numpages !== expectedDoc.numpages) {
        console.log('PDFs do not contain the same number of pages');
        return false;
      }

      if (inputDoc.text !== expectedDoc.text) {
        console.log('PDFs do not contain the same text');
        console.log('PDF expected text: ', expectedDoc.text);
        console.log('PDF input text: ', inputDoc.text);
        return false;
      }

      return true;
    },
  });
};

const toCSV = (buffer) => {
  return buffer
    .toString()
    .split('\n')
    .map((e) => e.trim())
    .map((e) => e.split(',').map((e) => e.trim()));
};

// remove the date part of the "Generated on <date>" header in PDFs as it's too complicated to set it to a fixed date
const removePDFGeneratedOnDate = (pdfDoc) => {
  const regex = /(Generated on )(.*)(Data time range)/;
  // removes the text in the second set of parenthesis of the regex above
  pdfDoc.text = pdfDoc.text.replace(regex, (match, p1, p2, p3) => {
    return `${p1} ${p3}`;
  });
};

exports.initialize = initialize;
