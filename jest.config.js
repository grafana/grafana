
module.exports = {
  verbose: false,
  "globals": {
    "ts-jest": {
      "tsConfigFile": "tsconfig.json"
    }
  },
  "transform": {
    "^.+\\.tsx?$": "<rootDir>/node_modules/ts-jest/preprocessor.js"
  },
  "moduleDirectories": ["node_modules", "public"],
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
  ],
  "snapshotSerializers": ["enzyme-to-json/serializer"],
};
