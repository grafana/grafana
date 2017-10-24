
module.exports = {
  verbose: false,
  "transform": {
    "^.+\\.tsx?$": "<rootDir>/node_modules/ts-jest/preprocessor.js"
  },
  "moduleDirectories": ["<rootDir>/node_modules", "<rootDir>/public"],
  "roots": [
    "<rootDir>/public"
  ],
  "testRegex": "(\\.|/)(jest)\\.(jsx?|tsx?)$",
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json"
  ],
  "setupFiles": [
    "./public/test/jest-shim.ts",
    "./public/test/jest-setup.ts"
  ]
};
