define(["./amd-dep.js","require"],function(amdDep, req){
	var amdCJS = req("./amd-cjs-module.js");
	return {
		name: "require2",
		amdCJS: amdCJS,
		amdDep: amdDep
	};
});
