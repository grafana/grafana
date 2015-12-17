System.register('custom/file.ext', [], function(_export) {
  return {
    setters: [],
    execute: function() {
      _export('custom', 'ext');
    }
  };
});