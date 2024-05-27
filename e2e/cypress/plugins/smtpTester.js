const ms = require('smtp-tester');

const initialize = (on, config) => {
  // starts the SMTP server at localhost:7777
  const port = 7777;
  const mailServer = ms.init(port);
  console.log('mail server at port %d', port);

  let lastEmail = {};

  // process all emails
  mailServer.bind((addr, id, email) => {
    console.log('email: ', email);
    lastEmail[email.headers.to] = email;
  });

  on('task', {
    resetEmails(email) {
      console.log('reset all emails');
      if (email) {
        delete lastEmail[email];
      } else {
        lastEmail = {};
      }
      return null;
    },

    getLastEmail(email) {
      return lastEmail[email] || null;
    },
  });
};

exports.initialize = initialize;
