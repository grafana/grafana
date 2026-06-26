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
};

exports.initialize = initialize;
