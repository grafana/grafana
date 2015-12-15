/* */ 
if (System._nodeRequire) {
  module.exports = System._nodeRequire('fs');
}
else {

  exports.readFileSync = function(address) {
    var output;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', address, false);
    xhr.onreadystatechange = function(e) {
      if (xhr.readyState == 4) {
        var status = xhr.status;
        if ((status > 399 && status < 600) || status == 400) {
          throw 'File read error on ' + address;
        }
        else
          output = xhr.responseText;
      }
    }
    xhr.send(null);
    return output;
  };

}
