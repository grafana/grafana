const fs = require('fs');
const { Jimp, diff } = require('jimp');
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
    async compareImages({expectedImageFilepath, newImageContent, updateExpectedImage = false}) {
      const inputBuffer = Buffer.from(newImageContent.data);
      if (updateExpectedImage) {
        fs.writeFileSync(expectedImageFilepath, inputBuffer);
        return true;
      }

      return compareImages(expectedImageFilepath, inputBuffer);
    }
  });

  on('task', {
    async compareCSVs({expectedCSVFilepath, newCSVContent, updateExpectedCSV = false}) {
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
    }
  });

  on('task', {
    async comparePDFs({expectedPDFFilepath, newPDFContent, updateExpectedPDF = false}) {
      const { pdf } = await import('pdf-to-img');

      const inputBuffer = Buffer.from(newPDFContent.data);
      if (updateExpectedPDF) {
        fs.writeFileSync(expectedPDFFilepath, inputBuffer);
        return true;
      }

      const inputDoc = await pdf(inputBuffer, { scale: 2 });
      const expectedDoc = await pdf(expectedPDFFilepath, { scale: 2 });
      if (expectedDoc.length !== inputDoc.length) {
        return false;
      }

      for await (const expectedImage of expectedDoc) {
        for await (const inputImage of inputDoc) {
          if (!(await compareImages(expectedImage, inputImage))) {
            return false;
          }
        }
      }

      return true;
    }
  });
};

const compareImages = async (expectedImageBufferOrFilePath, inputImageBuffer) => {
  const inputImage = await Jimp.read(inputImageBuffer);
  const expectedImage = await Jimp.read(expectedImageBufferOrFilePath);

  const pixelDiff = diff(expectedImage, inputImage, .3);
  return pixelDiff.percent <= .01;
}

const toCSV = (buffer) => {
  return buffer.toString()
    .split('\n')
    .map(e => e.trim())
    .map(e => e.split(',').map(e => e.trim()));
}

exports.initialize = initialize;
